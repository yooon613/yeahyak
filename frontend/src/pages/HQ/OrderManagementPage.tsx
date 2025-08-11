
import {
  Button,
  Cascader,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Layout,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { TableProps } from 'antd';
import { instance } from '../../api/api';

// --- 타입 정의 ---
interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotalPrice: number;
  productId: number;
}

interface Order {
  orderId: number;
  pharmacyName: string;
  createdAt: string;
  totalPrice: number;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELED';
  items: OrderItem[];
}

interface OrderTableDataType extends Order {
  key: React.Key;
  productSummary: string;
}

interface Option {
  value: string;
  label: string;
  children?: Option[];
}

// --- 상수 및 헬퍼 함수 ---
const { Content } = Layout;
const { Text } = Typography;

const geoOptions: Option[] = [
    {
        value: '충남충북',
        label: '충남충북',
        children: [
          { value: '천안', label: '천안' },
          { value: '대전', label: '대전' },
          { value: '청주', label: '청주' },
          { value: 'test1', label: 'test1' },
          { value: 'test2', label: 'test2' },
        ],
    },
];

// TODO : 태그 관련 논의 필요함
const statusOptions = [
  { value: 'REQUESTED', label: '승인 대기' },
  { value: 'APPROVED', label: '승인 완료' },
  { value: 'PROCESSING', label: '처리 중' },
  { value: 'SHIPPING', label: '배송 중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'CANCELED', label: '취소' },
];

const getStatusTag = (status: Order['status']) => {
    const option = statusOptions.find(o => o.value === status);
    const colorMap = {
        REQUESTED: 'blue',
        APPROVED: 'green',
        PROCESSING: 'purple',
        SHIPPING: 'orange',
        COMPLETED: 'gold',
        CANCELED: 'red',
    };
    return <Tag color={colorMap[status]}>{option ? option.label : status}</Tag>;
};


// --- 컴포넌트 ---
export default function OrderManagementPage() {
  const [orders, setOrders] = useState<OrderTableDataType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 6, total: 0 });
  const [filters, setFilters] = useState<Record<string, any>>({});
  
  const [selectedOrder, setSelectedOrder] = useState<OrderTableDataType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchOrders = useCallback(async (page: number, currentFilters: Record<string, any>) => {
    setLoading(true);
    try {
      const { branch, date, status } = currentFilters;
      const pharmacyName = Array.isArray(branch) && branch.length > 0 ? branch[branch.length - 1] : undefined;
      
      const params = {
        page: page - 1,
        size: pagination.pageSize,
        pharmacyName,
        status,
        // TODO: 백엔드에서 날짜 필터링 지원 시 추가
        // startDate: date ? date[0].format('YYYY-MM-DD') : undefined,
        // endDate: date ? date[1].format('YYYY-MM-DD') : undefined,
      };

      // [수정] API 호출 주소 변경 및 응답 데이터 안정성 강화
      const response = await instance.get('/orders/admin/orders', { params });
      const responseData = response.data || {};
      const orderList = responseData.data || [];
      const totalElements = responseData.totalElements || 0;

      const fetchedOrders = orderList.map((order: Order) => ({
        ...order,
        key: order.orderId,
        productSummary:
          order.items.length > 0
            ? `${order.items[0].productName}${order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}`
            : '주문 항목 없음',
      }));

      setOrders(fetchedOrders);
      setPagination(prev => ({ ...prev, current: page, total: totalElements }));

    } catch (e) {
      console.error('발주 목록 불러오기 실패:', e);
      messageApi.error('주문 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize, messageApi]);

  useEffect(() => {
    fetchOrders(1, {});
  }, []);

  const handleTableChange: TableProps<OrderTableDataType>['onChange'] = (newPagination) => {
    fetchOrders(newPagination.current!, filters);
  };
  
  const handleFilterSearch = () => {
    const formValues = form.getFieldsValue();
    setFilters(formValues);
    fetchOrders(1, formValues);
  };

  const handleFilterReset = () => {
    form.resetFields();
    setFilters({});
    fetchOrders(1, {});
  };

  const handleStatusUpdate = async (orderId: number, newStatus: Order['status']) => {
    try {
      if (newStatus === 'APPROVED') {
        await instance.post(`/orders/${orderId}/approve`);
      } else if (newStatus === 'CANCELED') {
        await instance.patch(`/orders/${orderId}/reject`);
      }
      messageApi.success('상태가 변경되었습니다.');
      fetchOrders(pagination.current, filters); // 목록 새로고침
    } catch (error) {
      console.error('주문 상태 업데이트 실패:', error);
      messageApi.error('상태 변경에 실패했습니다.');
    }
  };

  const handleRowClick = (record: OrderTableDataType) => {
    setSelectedOrder(record);
    setModalVisible(true);
  };

  const columns: TableProps<OrderTableDataType>['columns'] = [
    { title: '주문번호', dataIndex: 'orderId', key: 'orderId', width: 100 },
    { title: '지점', dataIndex: 'pharmacyName', key: 'pharmacyName', width: 120 },
    { title: '요청일자', dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (text) => new Date(text).toLocaleDateString() },
    { title: '의약품', dataIndex: 'productSummary', key: 'productSummary', width: 200 },
    { title: '주문 금액', dataIndex: 'totalPrice', key: 'totalPrice', width: 120, render: (v) => `${v.toLocaleString()}원` },
    { title: '상태', dataIndex: 'status', key: 'status', width: 100, render: (status: Order['status'], record) =>
        status === 'REQUESTED' ? (
          <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(record.orderId, 'APPROVED'); }}>
            승인
          </Button>
        ) : (
          getStatusTag(status)
        ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Content style={{ margin: '24px', padding: '24px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: '30px' }}>
          <Col>
            <Text strong style={{ fontSize: '30px' }}>발주 조회/승인</Text>
          </Col>
        </Row>

        <Form layout="vertical" form={form} onFinish={handleFilterSearch}>
          <Row justify="space-between" style={{ padding: '5px 50px' }}>
            <Space>
              <Form.Item label="지점명" name="branch">
                <Cascader options={geoOptions} placeholder="지역 선택" />
              </Form.Item>
              <Form.Item label="상태" name="status">
                <Select allowClear options={statusOptions} placeholder="상태 선택" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item label="기간" name="date">
                <DatePicker.RangePicker placeholder={['시작일', '종료일']} style={{ width: 400 }} />
              </Form.Item>
            </Space>
            <Form.Item label=" ">
              <Button onClick={handleFilterReset}>옵션 초기화</Button>
              <Button type="primary" htmlType="submit" style={{ marginLeft: 8 }}>발주 조회</Button>
            </Form.Item>
          </Row>
        </Form>

        <Row justify="center" style={{ marginTop: 20 }}>
          <Col span={22}>
            <Table
              columns={columns}
              dataSource={orders}
              pagination={pagination}
              loading={loading}
              onChange={handleTableChange}
              onRow={(record) => ({ onClick: () => handleRowClick(record) })}
              rowKey="orderId"
            />
          </Col>
        </Row>

        <Modal
          title="발주 상세 정보"
          open={modalVisible}
          closable={false}
          onCancel={() => setModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setModalVisible(false)}>닫기</Button>,
            selectedOrder?.status === 'REQUESTED' && (
              <Button key="approve" type="primary" onClick={() => {
                  if (selectedOrder) {
                    handleStatusUpdate(selectedOrder.orderId, 'APPROVED');
                    setModalVisible(false);
                  }
              }}>
                승인
              </Button>
            ),
          ]}
          width={800}
        >
          {selectedOrder && (
            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="주문번호" span={1}>{selectedOrder.orderId}</Descriptions.Item>
              <Descriptions.Item label="지점명" span={1}>{selectedOrder.pharmacyName}</Descriptions.Item>
              <Descriptions.Item label="요청일자" span={1}>{new Date(selectedOrder.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="상태" span={2}>{getStatusTag(selectedOrder.status)}</Descriptions.Item>
              <Descriptions.Item label="주문 항목" span={2}>
                <Table
                  dataSource={selectedOrder.items}
                  columns={[
                    { title: '제품명', dataIndex: 'productName', key: 'productName' },
                    { title: '수량', dataIndex: 'quantity', key: 'quantity' },
                    { title: '단가', dataIndex: 'unitPrice', key: 'unitPrice', render: (v) => `${v.toLocaleString()}원` },
                    { title: '소계', dataIndex: 'subtotalPrice', key: 'subtotalPrice', render: (v) => `${v.toLocaleString()}원` },
                  ]}
                  pagination={false}
                  rowKey="productId"
                  size="small"
                />
              </Descriptions.Item>
              <Descriptions.Item label="총 주문 금액" span={2}>
                <Text strong style={{ fontSize: 16 }}>{`${selectedOrder.totalPrice.toLocaleString()}원`}</Text>
              </Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </Content>
    </>
  );
}