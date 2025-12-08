// Example usage of HtmlEditor with Ant Design Forms

import React from 'react';
import { Form, Button, Input } from 'antd';
import HtmlEditor from '@/Components/HtmlEditor';

const ExampleForm = () => {
  const [form] = Form.useForm();

  const handleSubmit = (values: any) => {
    // Access the HTML content directly from form values
    console.log('Form values:', values);
    console.log('HTML details:', values.details);
    
    // Alternative way to get values
    const formValues = form.getFieldsValue();
    console.log('Get field values:', formValues.details);
  };

  const handleGetValues = () => {
    // Get specific field value
    const detailsValue = form.getFieldValue('details');
    console.log('Details value:', detailsValue);
    
    // Get all form values
    const allValues = form.getFieldsValue();
    console.log('All values:', allValues);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        title: 'Sample Title',
        details: '<p>Sample HTML content</p>',
      }}
    >
      <Form.Item
        label="Title"
        name="title"
        rules={[{ required: true, message: 'Please enter title' }]}
      >
        <Input placeholder="Enter title" />
      </Form.Item>

      <Form.Item
        label="Details"
        name="details"
        rules={[
          {
            required: true,
            validator: (_, value) => {
              const textContent = (value || '')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();
              
              if (!textContent) {
                return Promise.reject(new Error('Please enter details'));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <HtmlEditor
          placeholder="Enter details..."
          height={250}
        />
      </Form.Item>

      <div className="flex gap-2">
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
        <Button onClick={handleGetValues}>
          Get Values
        </Button>
      </div>
    </Form>
  );
};

export default ExampleForm;