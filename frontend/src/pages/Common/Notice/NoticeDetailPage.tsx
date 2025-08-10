import type { DescriptionsProps } from 'antd';
import {
  Button,
  Card,
  Descriptions,
  Flex,
  message,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { USER_ROLE } from '../../../types/profile.type';
import type { Announcement } from '../../../types/announcement.type';
import { instance } from '../../../api/api';

export default function NoticeDetailPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [notice, setNotice] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  const basePath = user?.role === USER_ROLE.BRANCH ? '/branch' : '/hq';

  const fetchNotice = async () => {
    if (!id) {
      messageApi.error('잘못된 접근입니다.');
      setNotice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await instance.get(`/announcements/${id}`);
      const list: Announcement[] = Array.isArray(res?.data?.data) ? res.data.data : [];
      const item = list[0] ?? null;

      if (res.data?.success && item) {
        setNotice(item);
      } else {
        messageApi.error('공지사항 데이터를 불러올 수 없습니다.');
        setNotice(null);
      }
    } catch (e: any) {
      console.error('공지사항 로딩 실패:', e);
      messageApi.error(e?.response?.data?.message || '공지사항 로딩 중 오류가 발생했습니다.');
      setNotice(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      if (window.confirm('정말 삭제하시겠습니까?')) {
        await instance.delete(`/announcements/${id}`);
        messageApi.success('공지사항이 삭제되었습니다.');
        navigate(`${basePath}/notices`);
      }
    } catch (e: any) {
      console.error('공지사항 삭제 실패:', e);
      messageApi.error(e?.response?.data?.message || '공지사항 삭제 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Typography.Text>로딩 중...</Typography.Text>;
  if (!notice) return <Typography.Text>해당 공지사항을 찾을 수 없습니다.</Typography.Text>;

  const items: DescriptionsProps['items'] = [
    { key: 'title', label: '제목', children: notice.title },
    { key: 'type', label: '구분', children: notice.type },
    { key: 'createdAt', label: '작성일', children: dayjs(notice.createdAt).format('YYYY-MM-DD HH:mm') },
  ];

  if (notice.attachmentUrl) {
    items.push({
      key: 'attachmentUrl',
      label: '첨부파일',
      children: (
        <a href={notice.attachmentUrl} target="_blank" rel="noopener noreferrer">
          {notice.attachmentUrl}
        </a>
      ),
      span: 2,
    });
  }

  return (
    <>
      {contextHolder}
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        공지사항 상세
      </Typography.Title>

      <Descriptions bordered column={2} size="middle" style={{ marginBottom: 24 }} items={items} />

      <Card style={{ marginBottom: 24, padding: 24 }}>
        <div dangerouslySetInnerHTML={{ __html: notice.content }} />
      </Card>

      <Flex wrap style={{ justifyContent: 'space-between' }}>
        <Button type="default" onClick={() => navigate(`${basePath}/notices`)}>
          목록
        </Button>

        {user?.role === USER_ROLE.ADMIN && (
          <Space wrap>
            <Button type="text" danger onClick={handleDelete}>
              삭제
            </Button>
            <Button type="primary" onClick={() => navigate(`/hq/notices/${id}/edit`)}>
              수정
            </Button>
          </Space>
        )}
      </Flex>
    </>
  );
}
