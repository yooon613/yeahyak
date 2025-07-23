from flask import Flask, request, jsonify
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import io

app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict_order():
    if 'file' not in request.files:
        return jsonify({'error': 'CSV file is missing'}), 400

    file = request.files['file']
    df = pd.read_csv(file)

    # 1. 날짜 컬럼 정리
    df['date'] = df['date'].astype(str)
    df['date'] = df['date'].apply(lambda x: x if len(x) > 7 else x + '-01')
    df['date'] = pd.to_datetime(df['date'])

    # 2. 다음 달 계산
    last_date = df['date'].max()
    next_month = (last_date + pd.DateOffset(months=1)).replace(day=1)

    # 3. 중복 방지: 다음달 데이터가 이미 존재하면 예측 중단
    if next_month in df['date'].values:
        return jsonify({'error': f'{next_month.strftime("%Y-%m")} already exists in data'}), 400

    # 4. 다음달 예측용 행 자동 생성
    store_ids = df['store_id'].unique()
    product_names = df['product_name'].unique()

    future_raw = pd.DataFrame([
        {
            'date': next_month.strftime('%Y-%m-%d'),
            'store_id': store,
            'product_name': product,
            'stock_level': 0,
            'sales_quantity': 0,
            'expiration_days_left': 180,
            'ordered_quantity': 0
        }
        for store in store_ids for product in product_names
    ])
    df_full = pd.concat([df, future_raw], ignore_index=True)

    # 5. 전처리 함수
    def preprocess_data(df):
        df = df.sort_values(by='date')
        df_grouped = df.groupby(['store_id', 'product_name'], group_keys=False)\
                       .apply(lambda x: x.sort_values(by='date')).reset_index(drop=True)

        df_grouped['month'] = df_grouped['date'].dt.month
        df_grouped['year'] = df_grouped['date'].dt.year
        df_grouped['day_of_week'] = df_grouped['date'].dt.dayofweek

        for i in range(1, 4):
            df_grouped[f'sales_quantity_lag_{i}'] = df_grouped.groupby(['store_id', 'product_name'])['sales_quantity'].shift(i)

        df_grouped['sales_quantity_rolling_mean_3'] = df_grouped.groupby(['store_id', 'product_name'])['sales_quantity'].transform(lambda x: x.rolling(window=3).mean())
        df_grouped['sales_quantity_rolling_mean_6'] = df_grouped.groupby(['store_id', 'product_name'])['sales_quantity'].transform(lambda x: x.rolling(window=6).mean())

        df_grouped.fillna(0, inplace=True)

        train_data = df_grouped[df_grouped['date'] < next_month].copy()
        test_data = df_grouped[df_grouped['date'] == next_month].copy()

        for col in ['store_id', 'product_name']:
            train_data = pd.get_dummies(train_data, columns=[col], prefix=col)
            test_data = pd.get_dummies(test_data, columns=[col], prefix=col)

        missing_cols = set(train_data.columns) - set(test_data.columns)
        for col in missing_cols:
            test_data[col] = 0
        test_data = test_data[train_data.columns]

        return train_data, test_data

    # 6. 학습 및 예측
    train_data, test_data = preprocess_data(df_full)

    X_train = train_data.drop(columns=['ordered_quantity', 'date'])
    y_train = train_data['ordered_quantity']
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    X_test = test_data.drop(columns=['ordered_quantity', 'date'], errors='ignore')
    for col in X_train.columns:
        if col not in X_test.columns:
            X_test[col] = 0
    X_test = X_test[X_train.columns]

    y_pred = model.predict(X_test)
    test_data['predicted_order'] = y_pred.astype(int)

    # 7. 결과 정리
    original_df = df_full.copy()
    original_2025 = original_df[original_df['date'] == next_month][['date', 'store_id', 'product_name']].reset_index(drop=True)
    result = pd.concat([original_2025, test_data[['predicted_order']].reset_index(drop=True)], axis=1)

    return jsonify(result.to_dict(orient='records')), 200, {'Content-Type': 'application/json; charset=utf-8'}


if __name__ == '__main__':
    app.run(debug=True)
