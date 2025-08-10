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
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TiptapEditor from '../../components/TiptapEditor';
import { instance } from '../../api/api';

const GATEWAY_BASE = 'http://localhost:5000';

type NoticeType = 'NOTICE' | 'EPIDEMIC' | 'LAW' | 'NEW_PRODUCT';

export default function HqNoticeRegisterPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isEdited, setIsEdited] = useState(false);

  const watchedType = Form.useWatch('type', form) as NoticeType | undefined;
  const watchedContent = Form.useWatch('content', form);

  useEffect(() => {
    if (!isEdited && (watchedType || watchedContent)) setIsEdited(true);
  }, [watchedType, watchedContent, isEdited]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (isEdited) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [isEdited]);

  const summarizePath = useMemo(() => {
    switch (watchedType) {
      case 'EPIDEMIC':
        return '/summarize/epidemic';
      case 'LAW':
        return '/summarize/law';
      case 'NEW_PRODUCT':
        return '/summarize/pdf';
      default:
        return null;
    }
  }, [watchedType]);

  const acceptExt = useMemo(() => {
    if (watchedType === 'LAW') return '.txt';
    if (watchedType === 'EPIDEMIC' || watchedType === 'NEW_PRODUCT') return '.pdf';
    return '.pdf,.txt';
  }, [watchedType]);

  const aiEnabled = useMemo(() => {
    return !!summarizePath && fileList.length > 0 && !!fileList[0].originFileObj;
  }, [summarizePath, fileList]);

  const handleChange: UploadProps['onChange'] = ({ fileList }) => {
    setFileList(fileList);
    // TODO: 업로드 API 연동 후 실제 URL 저장으로 교체
    form.setFieldValue('attachmentUrl', fileList[0]?.name || '');
    setIsEdited(true);
  };

  const wrapAsHtml = (txt: string) => {
    const safe = (txt ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const withBreaks = safe.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    return withBreaks || '<p></p>';
  };

  const handleAiSummarize = async () => {
    if (!aiEnabled || !summarizePath) {
      messageApi.warning('AI 요약이 가능한 유형/파일을 확인해주세요.');
      return;
    }
    try {
      const fileObj = fileList[0].originFileObj as File;
      if (watchedType === 'LAW' && !fileObj.name.toLowerCase().endsWith('.txt')) {
        messageApi.warning('법령 요약은 .txt 파일만 지원합니다.');
        return;
      }
      if ((watchedType === 'EPIDEMIC' || watchedType === 'NEW_PRODUCT') &&
          !fileObj.name.toLowerCase().endsWith('.pdf')) {
        messageApi.warning('해당 유형은 .pdf 파일만 지원합니다.');
        return;
      }

      const formData = new FormData();
      formData.append('file', fileObj);

      const res = await fetch(`${GATEWAY_BASE}${summarizePath}`, { method: 'POST', body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error('요약 서버 응답 오류');
      if (!json.success) throw new Error(json.error || '요약 실패');

      const summary: string | undefined = json.data?.summary;
      if (!summary) throw new Error('요약 결과가 없습니다.');

      form.setFieldsValue({ content: wrapAsHtml(summary) });
      setIsEdited(true);
      messageApi.success('AI가 문서를 요약했습니다.');
    } catch (e: any) {
      console.error('문서 요약 실패:', e);
      messageApi.error(e?.message || '문서 요약 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        type: values.type as NoticeType,
        title: String(values.title).trim(),
        content: values.content as string,
        attachmentUrl: values.attachmentUrl || '',
      };
      if (!payload.title) {
        messageApi.warning('제목은 공백만 입력할 수 없습니다.');
        return;
      }

      const res = await instance.post('/announcements', payload);
      const ok = res?.data?.success;
      const data = res?.data?.data;
      const item = Array.isArray(data) ? data[0] : data;
      const id = item?.announcementId;

      if (ok && id) {
        messageApi.success('공지사항이 등록되었습니다.');
        setIsEdited(false);
        form.resetFields();
        setFileList([]);
        navigate(`/hq/notices/${id}`);
        return;
      }
      messageApi.error('공지사항 등록 후 ID를 가져오는 데 실패했습니다.');
    } catch (e: any) {
      console.error('공지사항 등록 실패:', e);
      messageApi.error(
        e?.response?.data?.message ?? e?.message ?? '공지사항 등록 중 오류가 발생했습니다.'
      );
    }
  };

  const handleBack = () => {
    if (isEdited) {
      Modal.confirm({
        title: '페이지를 나가시겠습니까?',
        content: '작성 중인 내용이 사라집니다.',
        okText: '나가기',
        cancelText: '취소',
        onOk: () => navigate(-1),
      });
    } else {
      navigate(-1);
    }
  };

  return (
    <>
      {contextHolder}
      <Space size="large" align="baseline">
        <Button type="link" size="large" shape="circle" icon={<LeftOutlined />} onClick={handleBack} />
        <Typography.Title level={3} style={{ marginBottom: 24 }}>
          공지사항 작성
        </Typography.Title>
      </Space>

      <Form
        form={form}
        name="notice-register"
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
        initialValues={{ type: 'NOTICE', title: '', content: '', attachmentUrl: '' }}
      >
        <Flex gap={8}>
          <Form.Item
            name="type"
            label="카테고리"
            rules={[{ required: true, message: '카테고리를 선택해주세요.' }]}
            style={{ flex: 1 }}
          >
            <Select
              placeholder="카테고리 선택"
              options={[
                { value: 'NOTICE', label: '공지' },
                { value: 'EPIDEMIC', label: '감염병' },
                { value: 'LAW', label: '법령' },
                { value: 'NEW_PRODUCT', label: '신제품' },
              ]}
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
            style={{ flex: 3 }}
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
              accept={acceptExt}
              listType="text"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={handleChange}
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

          <Space>
            <Typography.Text type="secondary">{dayjs().format('YYYY-MM-DD HH:mm')}</Typography.Text>
            <Button type="primary" htmlType="submit">
              등록
            </Button>
          </Space>
        </Flex>
      </Form>
    </>
  );
}
