
// 필요한 antd 컴포넌트 및 React 훅들을 가져옵니다.
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useState, useEffect, useCallback } from 'react';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { instance as api } from '../../api/api';
import { useAuthStore } from '../../stores/authStore';
import type { Pharmacy } from '../../types/profile.type';
import { ReloadOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Title } = Typography;

// --- 타입 정의 ---
interface ReturnResponse {
  returnId: number;
  pharmacyId: number;
  pharmacyName: string;
  orderId: number | null;
  createdAt: string;
  updatedAt: string | null;
  totalPrice: number;
  status: 'REQUESTED' | 'REJECTED' | 'APPROVED' | 'PROCESSING' | 'COMPLETED';
  items: ReturnItemResponse[];
}

interface ReturnItemResponse {
  productId: number;
  productName: string;
  manufacturer: string;
  reason: string;
  quantity: number;
  unitPrice: number;
  subtotalPrice: number;
}

interface Product {
  productId: number | null;
  productName: string;
  productCode?: string;
  manufacturer?: string;
  unitPrice: number;
}

interface OrderItem {
  productId: number | null;
  productName: string;
  productCode?: string;
  manufacturer?: string;
  quantity: number;
  unitPrice: number;
  subtotalPrice: number;
}

interface Order {
  orderId: number;
  pharmacyName: string;
  createdAt: string;
  totalPrice: number;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELED';
  items: OrderItem[];
}

interface CartItem {
  key: string;
  orderId: number;
  productId: number;
  productName: string;
  productCode?: string;
  manufacturer?: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  returnDate: string;
}

interface ReturnDetailModalProps {
  open: boolean;
  onClose: () => void;
  returnDetail: ReturnResponse | null;
}

// --- 헬퍼 함수 ---
const getStatusColor = (status: ReturnResponse['status']) => {
  const colorMap = { REQUESTED: 'blue', APPROVED: 'cyan', PROCESSING: 'gold', COMPLETED: 'green', REJECTED: 'red' };
  return colorMap[status] || 'default';
};

const statusTranslations: Record<ReturnResponse['status'], string> = {
  'REQUESTED': '요청됨',
  'REJECTED': '거절됨',
  'APPROVED': '승인됨',
  'PROCESSING': '처리 중',
  'COMPLETED': '완료됨',
};

// --- 상세 정보 모달 컴포넌트 ---
const ReturnDetailModal: React.FC<ReturnDetailModalProps> = ({ open, onClose, returnDetail }) => {
  if (!returnDetail) return null;
  return (
    <Modal title="반품 상세 정보" open={open} onCancel={onClose} footer={null} width={800}>
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="반품 ID">{returnDetail.returnId}</Descriptions.Item>
        <Descriptions.Item label="약국명">{returnDetail.pharmacyName}</Descriptions.Item>
        <Descriptions.Item label="신청일">{new Date(returnDetail.createdAt).toLocaleString()}</Descriptions.Item>
        <Descriptions.Item label="처리일">{returnDetail.updatedAt ? new Date(returnDetail.updatedAt).toLocaleString() : '-'}</Descriptions.Item>
        <Descriptions.Item label="총 반품 금액">{returnDetail.totalPrice.toLocaleString()}원</Descriptions.Item>
        <Descriptions.Item label="상태">
          <Tag color={getStatusColor(returnDetail.status)}>{statusTranslations[returnDetail.status] || returnDetail.status}</Tag>
        </Descriptions.Item>
      </Descriptions>
      <Typography.Title level={4} style={{ marginTop: 24, marginBottom: 16 }}>반품 품목</Typography.Title>
      <Table dataSource={returnDetail.items} columns={[{ title: '제품명', dataIndex: 'productName' }, { title: '제조사', dataIndex: 'manufacturer' }, { title: '수량', dataIndex: 'quantity' }, { title: '단가', dataIndex: 'unitPrice', render: (val) => `${val.toLocaleString()}원` }, { title: '소계', dataIndex: 'subtotalPrice', render: (val) => `${val.toLocaleString()}원` }]} pagination={false} rowKey="productId" size="small" />
      <Typography.Title level={4} style={{ marginTop: 24, marginBottom: 16 }}>반품 사유</Typography.Title>
      <Card><Typography.Paragraph>{returnDetail.items[0]?.reason || '사유 없음'}</Typography.Paragraph></Card>
    </Modal>
  );
};

// --- 메인 페이지 컴포넌트 ---
export default function ReturnRequestPage() {
  const { profile } = useAuthStore();
  const pharmacyProfile = profile as Pharmacy;
  const [form] = Form.useForm();
  const [items, setItems] = useState<CartItem[]>([]);
  const [returnHistory, setReturnHistory] = useState<ReturnResponse[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [productList, setProductList] = useState<Product[]>([]);
  const [currentMaxReturnQuantity, setCurrentMaxReturnQuantity] = useState<number>(1);
  const [modalVisible, setModalVisible] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<ReturnResponse | null>(null);
  const [ordersForModal, setOrdersForModal] = useState<Order[]>([]);

  const [loading, setLoading] = useState({ history: false });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 5, total: 0 });

  const fetchReturnHistory = useCallback(async (page = 1) => {
    if (!pharmacyProfile?.pharmacyId) return;
    setLoading(prev => ({ ...prev, history: true }));
    try {
      const params = {
        pharmacyId: pharmacyProfile.pharmacyId,
        page: page - 1,
        size: pagination.pageSize,
      };
      const response = await api.get('/branch/returns', { params });
      const responseData = response.data || {};
      setReturnHistory(responseData.data || []);
      setPagination(prev => ({ ...prev, current: page, total: responseData.totalElements || 0 }));
    } catch (error) {
      message.error('반품 내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, history: false }));
    }
  }, [pharmacyProfile, pagination.pageSize]);

  const fetchOrders = useCallback(async () => {
    if (!pharmacyProfile?.pharmacyId) return;
    try {
      const url = `/orders/branch/orders?pharmacyId=${pharmacyProfile.pharmacyId}&status=APPROVED`;
      const response = await api.get(url);
      if (response.data.success) {
        setOrdersForModal(response.data.data || []);
      } else {
        message.error(response.data.message || '주문 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      message.error('주문 목록을 불러오는 중 오류가 발생했습니다.');
    }
  }, [pharmacyProfile]);

  useEffect(() => {
    if (pharmacyProfile?.pharmacyId) {
      fetchOrders();
      fetchReturnHistory(1);
    }
  }, [pharmacyProfile, fetchOrders, fetchReturnHistory]);

  const handleOrderClick = () => { setModalVisible(true); fetchOrders(); };
  const handleOrderSelect = (order: Order) => {
    form.setFieldValue('orderNumber', order.orderId);
    setSelectedOrder(order);
    const products = order.items
      .filter(item => item.productId !== null)
      .map(item => ({ ...item, productId: item.productId!, productCode: item.productCode, manufacturer: item.manufacturer }));
    setProductList(products);
    form.resetFields(['product', 'quantity', 'reason']);
    setModalVisible(false);
  };

  const handleProductChange = (productId: number) => {
    const orderedItem = selectedOrder?.items.find(item => item.productId === productId);
    const maxQty = orderedItem ? orderedItem.quantity : 1; // Explicitly check if orderedItem exists
    setCurrentMaxReturnQuantity(maxQty);
    const product = productList.find(p => p.productId === productId);
    form.setFieldsValue({ unitPrice: product?.unitPrice || '', quantity: null });
  };

  const handleAddItem = () => {
    form.validateFields().then(values => {
      if (!selectedOrder) { message.error('주문번호를 먼저 선택해주세요.'); return; }
      const product = productList.find(p => p.productId === values.product);
      if (!product) { message.error('제품 정보를 찾을 수 없습니다.'); return; }
      if (items.some(item => item.orderId === selectedOrder.orderId && item.productId === product.productId)) {
        message.warning('이미 추가된 반품 항목입니다.'); return; }
      const newItem: CartItem = {
        key: `${selectedOrder.orderId}-${product.productId}`,
        orderId: selectedOrder.orderId,
        productId: product.productId!,
        productName: product.productName,
        productCode: product.productCode,
        manufacturer: product.manufacturer,
        quantity: values.quantity,
        unitPrice: product.unitPrice,
        reason: values.reason,
        returnDate: today,
      };
      setItems([...items, newItem]);
      form.resetFields(['product', 'quantity', 'reason']);
    }).catch(() => message.error('필수 입력 항목을 모두 채워주세요.'));
  };

  const handleRemoveItem = (key: string) => setItems(items.filter(item => item.key !== key));

  const handleSubmit = async () => {
    if (items.length === 0 || !selectedOrder) { message.warning('반품할 항목을 추가해주세요.'); return; }
    try {
      const response = await api.post('/branch/returns', { 
        pharmacyId: pharmacyProfile.pharmacyId, 
        orderId: selectedOrder.orderId, 
        reason: items[0].reason, 
        items: items.map(item => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })) 
      });
      if (response.data.success) {
        message.success('반품 요청이 성공적으로 제출되었습니다.');
        setItems([]);
        form.resetFields();
        setSelectedOrder(null);
        fetchReturnHistory(1);
      } else {
        message.error(response.data.message || '반품 요청에 실패했습니다.');
      }
    } catch (error) {
      message.error('반품 요청 중 오류가 발생했습니다.');
    }
  };

  const handleReturnHistoryRowClick = async (record: ReturnResponse) => {
    try {
      const response = await api.get(`/branch/returns/${record.returnId}`);
      if (response.data.success) {
        setSelectedReturnDetail(response.data.data);
        setIsDetailModalOpen(true);
      } else {
        message.error(response.data.message || '반품 상세 정보를 불러오는 데 실패했습니다.');
      }
    } catch (error) {
      message.error('반품 상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const columns: ColumnsType<CartItem> = [
    { title: '신청일', dataIndex: 'returnDate' },
    { title: '제품명', dataIndex: 'productName' },
    { title: '제품번호', dataIndex: 'productCode' },
    { title: '제조사', dataIndex: 'manufacturer' },
    { title: '반품 수량', dataIndex: 'quantity' },
    { title: '단가', dataIndex: 'unitPrice', render: (val) => `${val.toLocaleString()}원` },
    { title: '반품 금액', render: (_, record) => `${(record.quantity * record.unitPrice).toLocaleString()}원` },
    { title: '반품 사유', dataIndex: 'reason' },
    { title: '관리', render: (_, record) => <Button danger onClick={() => handleRemoveItem(record.key)}>삭제</Button> },
  ];

  const historyColumns: ColumnsType<ReturnResponse> = [
    { title: '신청일', dataIndex: 'createdAt', render: (text) => new Date(text).toLocaleDateString() },
    { title: '반품번호', dataIndex: 'returnId' },
    { title: '총 반품 금액', dataIndex: 'totalPrice', render: (val) => `${val.toLocaleString()}원` },
    { title: '상태', dataIndex: 'status', render: (status) => <Tag color={getStatusColor(status)}>{statusTranslations[status] || status}</Tag> },
    { title: '반품 품목', dataIndex: 'items', render: (items: ReturnItemResponse[]) => `${items[0]?.productName || ''}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}` },
  ];

  const handleTableChange: TableProps<ReturnResponse>['onChange'] = (newPagination) => {
    fetchReturnHistory(newPagination.current!);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>반품 요청</Title>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="orderNumber" label={<span style={{ color: 'red' }}>* 주문번호</span>} rules={[{ required: true, message: '주문번호를 선택해주세요.' }]}>
              <Input readOnly onClick={handleOrderClick} placeholder="주문번호 선택" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16} align="bottom">
          <Col span={4}>
            <Form.Item name="product" label={<span style={{ color: 'red' }}>* 제품명</span>} rules={[{ required: true, message: '제품을 선택해주세요.' }]}>
              <Select placeholder="제품 선택" onChange={handleProductChange} disabled={!selectedOrder}>
                {productList.map((p, index) => (<Option key={p.productId !== null ? p.productId : `product-${index}`} value={p.productId!}>{p.productName}</Option>))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="quantity" label={<span style={{ color: 'red' }}>* 반품 수량</span>} rules={[{ required: true, message: '반품 수량 입력.' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || value <= currentMaxReturnQuantity) { return Promise.resolve(); } return Promise.reject(new Error(`반품 수량은 주문 수량(${currentMaxReturnQuantity}개)을 초과할 수 없습니다.`)); } })]}>
              <InputNumber min={1} max={currentMaxReturnQuantity} style={{ width: '100%' }} placeholder={`주문 수량: ${currentMaxReturnQuantity || 0}개`} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="단가">
              <Input disabled value={productList.find(p => p.productId === form.getFieldValue('product'))?.unitPrice ? `${productList.find(p => p.productId === form.getFieldValue('product'))?.unitPrice.toLocaleString()}원` : ''} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="reason" label={<span style={{ color: 'red' }}>* 반품 사유</span>} rules={[{ required: true, message: '반품 사유 입력.' }]}>
              <Input.TextArea placeholder="반품 사유 입력" autoSize={{ minRows: 1, maxRows: 4 }} />
            </Form.Item>
          </Col>
          <Col><Form.Item><Button type="primary" onClick={handleAddItem} style={{ marginTop: 30 }}>항목 추가</Button></Form.Item></Col>
        </Row>
      </Form>

      <Table columns={columns} dataSource={items} pagination={false} style={{ marginTop: 16 }} rowKey="key" />
      <div style={{ textAlign: 'right', marginTop: 12 }}>총 반품 금액: <strong>{totalAmount.toLocaleString()}원</strong></div>
      <div style={{ textAlign: 'right', marginTop: 12 }}><Button type="primary" onClick={handleSubmit}>반품 신청</Button></div>

      <Card title={
        <Row justify="space-between" align="middle">
          <Col><Title level={4} style={{ margin: 0 }}>반품 진행 현황</Title></Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => fetchReturnHistory(pagination.current)} loading={loading.history}>
              새로고침
            </Button>
          </Col>
        </Row>
      } style={{ marginTop: 48 }}>
        <Table
          columns={historyColumns}
          dataSource={returnHistory}
          rowKey="returnId"
          pagination={pagination}
          loading={loading.history}
          onChange={handleTableChange}
          onRow={(record) => ({ onClick: () => handleReturnHistoryRowClick(record) })}
        />
      </Card>

      <Modal title="주문번호 선택" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null}>
        {ordersForModal.length > 0 ? (
          ordersForModal.map(order => (
            <Card key={order.orderId} hoverable onClick={() => handleOrderSelect(order)} style={{ marginBottom: 16 }}>
              <p><strong>주문번호:</strong> {order.orderId}</p>
              <p><strong>지점명:</strong> {order.pharmacyName}</p>
              <p><strong>요청일자:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
              <p><strong>총 금액:</strong> {order.totalPrice.toLocaleString()}원</p>
            </Card>
          ))
        ) : <p>주문 내역이 없습니다.</p>}
      </Modal>

      <ReturnDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} returnDetail={selectedReturnDetail} />
    </div>
  );
}
