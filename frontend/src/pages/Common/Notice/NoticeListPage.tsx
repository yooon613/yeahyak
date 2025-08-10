import {
  Button,
  Flex,
  Input,
  message,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  type TableProps,
  type TabsProps,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { instance } from '../../../api/api';
import { useAuthStore } from '../../../stores/authStore';
import { type Announcement, type AnnouncementType } from '../../../types/announcement.type';
import { USER_ROLE } from '../../../types/profile.type';

const PAGE_SIZE = 10;

export default function NoticeListPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<AnnouncementType>('NOTICE');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [notices, setNotices] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        type: activeTab,
        page: currentPage - 1,
        size: PAGE_SIZE,
      };
      if (appliedKeyword.trim()) params.keyword = appliedKeyword.trim();

      const res = await instance.get('/announcements', { params });
      if (res.data?.success) {
        const list: Announcement[] = Array.isArray(res.data?.data) ? res.data.data : [];
        const totalElements: number = res.data?.totalElements ?? 0;
        setNotices(list);
        setTotal(totalElements);
      } else {
        setNotices([]);
        setTotal(0);
      }
    } catch (e: any) {
      console.error('공지사항 목록 로딩 실패:', e);
      messageApi.error(e?.response?.data?.message || '공지사항 목록 로딩 중 오류가 발생했습니다.');
      setNotices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [activeTab, currentPage, appliedKeyword]);

  const handleTabChange = (key: string) => {
    setActiveTab(key as AnnouncementType);
    setCurrentPage(1);
    setKeyword('');
    setAppliedKeyword('');
  };

  const handleSearch = () => {
    setAppliedKeyword(keyword);
    setCurrentPage(1);
  };

  const tableColumns: TableProps<Announcement>['columns'] = [
    { title: '번호', dataIndex: 'announcementId', key: 'announcementId', width: 80 },
    { title: '제목', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '작성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      width: 200,
      // 서버는 createdAt DESC 고정이므로 클라 정렬은 표시만
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      defaultSortOrder: 'descend',
    },
  ];

  const renderTable = () => (
    <Table
      bordered
      columns={tableColumns}
      dataSource={notices}
      loading={loading}
      rowKey="announcementId"
      onRow={(record) => ({
        onClick: () => {
          const basePath = user?.role === USER_ROLE.BRANCH ? '/branch' : '/hq';
          navigate(`${basePath}/notices/${record.announcementId}`);
        },
        style: { cursor: 'pointer' },
      })}
      pagination={{
        position: ['bottomCenter'],
        current: currentPage,
        total: total,
        pageSize: PAGE_SIZE,
        onChange: (page) => setCurrentPage(page),
        showSizeChanger: false,
      }}
    />
  );

  const tabsItems: TabsProps['items'] = [
    {
      key: 'NOTICE',
      label: '공지사항',
      children: renderTable(),
    },
    {
      key: 'EPIDEMIC',
      label: '감염병',
      children: renderTable(),
    },
    {
      key: 'LAW',
      label: '법령',
      children: renderTable(),
    },
    {
      key: 'NEW_PRODUCT',
      label: '신제품',
      children: renderTable(),
    },
  ];

  return (
    <>
      {contextHolder}
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        공지사항 목록
      </Typography.Title>

      <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabsItems} centered />

      <Flex wrap style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Space.Compact>
          <Input.Search
            allowClear
            value={keyword}
            placeholder="검색어 입력"
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
          />
        </Space.Compact>

        {user?.role === USER_ROLE.ADMIN && (
          <Button type="primary" onClick={() => navigate('/hq/notices/new')}>
            작성
          </Button>
        )}
      </Flex>
    </>
  );
}
