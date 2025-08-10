import { LeftOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import {
  Button,
  Flex,
  Form,
  Input,
  message,
  Select,
  Space,
  Typography,
  Upload,
  Modal,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TiptapEditor from '../../components/TiptapEditor';
import { instance } from '../../api/api';
import type { Announcement } from '../../types/announcement.type';

export default function HqNoticeEditPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { id } = useParams();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEdited, setIsEdited] = useState(false);

  const watchedType = Form.useWatch('type', form);
  const watchedContent = Form.useWatch('content', form);

  // 공지사항 로드
  const fetchNotice = async () => {
    if (!id) {
      messageApi.error('잘못된 접근입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await instance.get(`/announcements/${id}`);
      const list: Announcement[] = Array.isArray(res?.data?.data) ? res.data.data : [];
      const notice: Announcement | null = list[0] ?? null;

      if (!notice) {
        messageApi.error('공지사항 정보를 불러오지 못했습니다.');
        return;
      }

      form.setFieldsValue({
        type: notice.type,
        title: notice.title,
        content: notice.content,
        attachmentUrl: notice.attachmentUrl || '',
      });

      if (notice.attachmentUrl) {
        setFileList([
          {
            uid: '-1',
            name: notice.attachmentUrl.split('/').pop() || '첨부파일',
            status: 'done',
            url: notice.attachmentUrl,
          },
        ]);
      }
      setIsEdited(false);
    } catch (e: any) {
      console.error('공지사항 로딩 실패:', e);
      messageApi.error(e?.response?.data?.message ?? e?.message ?? '공지사항 로딩 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 수정 감지
  useEffect(() => {
    if (!isEdited && (watchedType || watchedContent)) setIsEdited(true);
  }, [watchedType, watchedContent, isEdited]);

  // 첨부파일 변경/삭제
  const handleChange: UploadProps['onChange'] = ({ fileList: fl }) => {
    setFileList(fl);
    const f = fl[0];
    if (f?.originFileObj) {
      // TODO: 실제 업로드 후 응답 URL을 저장하세요.
      form.setFieldValue('attachmentUrl', f.name || '');
    } else if (!f) {
      form.setFieldValue('attachmentUrl', '');
    }
    setIsEdited(true);
  };

  const handleRemove: UploadProps['onRemove'] = async () => {
    form.setFieldValue('attachmentUrl', '');
    setFileList([]);
    setIsEdited(true);
    return true;
  };

  // (옵션) AI 요약 버튼 — 실제 엔드포인트 연결되면 구현
  const aiEnabled = useMemo(() => {
    return !!watchedType && fileList.length > 0 && !!fileList[0].originFileObj;
  }, [watchedType, fileList]);

  const handleAiSummarize = async () => {
    messageApi.info('요약 서버 엔드포인트가 아직 연결되지 않았습니다.');
  };

  // PATCH: type은 변경하지 않음(백엔드 기준)
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        title: String(values.title).trim(),
        content: values.content as string,
        attachmentUrl: values.attachmentUrl || '',
      };
      if (!payload.title) {
        messageApi.warning('제목은 공백만 입력할 수 없습니다.');
        return;
      }

      const res = await instance.patch(`/announcements/${id}`, payload);
      if (res.data?.success) {
        messageApi.success('공지사항이 수정되었습니다.');
        setIsEdited(false);
        navigate(`/hq/notices/${id}`);
      } else {
        messageApi.error('공지사항 수정에 실패했습니다.');
      }
    } catch (e: any) {
      console.error('공지사항 수정 실패:', e);
      messageApi.error(e?.response?.data?.message ?? e?.message ?? '공지사항 수정 중 오류가 발생했습니다.');
    }
  };

  const handleBack = () => {
    if (isEdited) {
      Modal.confirm({
        title: '페이지를 나가시겠습니까?',
        content: '수정 중인 내용이 사라집니다.',
        okText: '나가기',
        cancelText: '취소',
        onOk: () => navigate(-1),
      });
    } else {
      navigate(-1);
    }
  };

  if (loading) return <Typography.Text>로딩 중...</Typography.Text>;

  return (
    <>
      {contextHolder}
      <Space size="large" align="baseline">
        <Button type="link" size="large" shape="circle" icon={<LeftOutlined />} onClick={handleBack} />
        <Typography.Title level={3} style={{ marginBottom: 24 }}>
          공지사항 수정
        </Typography.Title>
      </Space>

      <Form form={form} name="notice-edit" layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Flex gap={8}>
          <Form.Item
            name="type"
            label="카테고리"
            rules={[{ required: true, message: '카테고리를 선택해주세요.' }]}
            style={{ flex: 1 }}
          >
            <Select
              options={[
                { value: 'NOTICE', label: '공지' },
                { value: 'EPIDEMIC', label: '감염병' },
                { value: 'LAW', label: '법령' },
                { value: 'NEW_PRODUCT', label: '신제품' },
              ]}
              disabled // 🔒 PATCH 기준: type 변경 미지원
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="제목"
            rules={[
              { required: true, message: '제목을 입력해주세요.' },
              { max: 200, message: '제목은 200자 이하여야 합니다.' },
              {
                validator: (_, v) =>
                  (v && String(v).trim().length > 0)
                    ? Promise.resolve()
                    : Promise.reject(new Error('제목은 공백만 입력할 수 없습니다.')),
              },
            ]}
            style={{ flex: 5 }}
          >
            <Input />
          </Form.Item>
        </Flex>

        <Form.Item
          name="content"
          label="내용"
          rules={[
            { required: true, message: '내용을 입력해주세요.' },
            {
              validator: (_, v) =>
                (v && String(v).replace(/<[^>]*>/g, '').trim().length > 0)
                  ? Promise.resolve()
                  : Promise.reject(new Error('내용은 공백만 입력할 수 없습니다.')),
            },
          ]}
        >
          <TiptapEditor
            value={watchedContent}
            onChange={(val: string) => {
              form.setFieldValue('content', val);
              if (!isEdited) setIsEdited(true);
            }}
          />
        </Form.Item>

        <Flex wrap justify="space-between" gap={8}>
          <Space wrap align="baseline">
            <Form.Item name="attachmentUrl" noStyle>
              <Input type="hidden" />
            </Form.Item>

            <Upload
              accept=".pdf,.txt"
              listType="text"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={handleChange}
              onRemove={handleRemove}
              maxCount={1}
            >
              {fileList.length >= 1 ? null : (
                <Button type="default" icon={<UploadOutlined />}>
                  첨부파일
                </Button>
              )}
            </Upload>

            <Button type="primary" disabled={!aiEnabled} onClick={handleAiSummarize}>
              AI 요약
            </Button>
          </Space>

          <Button type="primary" htmlType="submit">
            저장
          </Button>
        </Flex>
      </Form>
    </>
  );
}
