-- ============================================================================
-- TCC IT Service & Asset Management System - Supabase PostgreSQL Schema
-- All 10 tables shared by PROD and UAT environments
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. items (อุปกรณ์ไอทีในคลัง)
CREATE TABLE IF NOT EXISTS public.items (
  item_id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  status TEXT DEFAULT 'Available',
  image_name TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  drive_file_id TEXT DEFAULT ''
);

-- 2. logs (ประวัติการยืม-คืนอุปกรณ์)
CREATE TABLE IF NOT EXISTS public.logs (
  trans_id TEXT PRIMARY KEY,
  "timestamp" TEXT DEFAULT '',
  item_id TEXT NOT NULL,
  borrower_name TEXT DEFAULT '',
  borrower_dept TEXT DEFAULT '',
  borrower_contact TEXT DEFAULT '',
  borrow_date TEXT DEFAULT '',
  expected_return TEXT DEFAULT '',
  actual_return TEXT DEFAULT '',
  trans_status TEXT DEFAULT 'Borrowed',
  notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_logs_item_id ON public.logs (item_id);
CREATE INDEX IF NOT EXISTS idx_logs_trans_status ON public.logs (trans_status);

-- 3. categories (หมวดหมู่อุปกรณ์)
CREATE TABLE IF NOT EXISTS public.categories (
  category_name TEXT PRIMARY KEY
);

-- 4. departments (ฝ่าย / แผนก)
CREATE TABLE IF NOT EXISTS public.departments (
  department_name TEXT PRIMARY KEY
);

-- 5. user_roles (ผู้ใช้งานและสิทธิ์)
CREATE TABLE IF NOT EXISTS public.user_roles (
  email TEXT PRIMARY KEY,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  dept TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  password TEXT DEFAULT '123456',
  status TEXT DEFAULT 'active',
  remark TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);

-- 6. ticket_categories (หมวดหมู่ปัญหาแจ้งซ่อม)
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  category_name TEXT PRIMARY KEY,
  sort_order INTEGER DEFAULT 0
);

-- 7. internal_systems (ระบบสารสนเทศภายใน / เว็บไซต์)
CREATE TABLE IF NOT EXISTS public.internal_systems (
  system_name TEXT PRIMARY KEY,
  sort_order INTEGER DEFAULT 0
);

-- 8. tickets (รายการแจ้งซ่อม Helpdesk)
CREATE TABLE IF NOT EXISTS public.tickets (
  ticket_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',
  reporter_name TEXT DEFAULT '',
  reporter_dept TEXT DEFAULT '',
  reporter_contact TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  sla_target TEXT DEFAULT '',
  assigned_agent TEXT DEFAULT '',
  resolved_at TEXT DEFAULT '',
  csat_score INTEGER DEFAULT 0,
  csat_feedback TEXT DEFAULT '',
  attachment_name TEXT DEFAULT '',
  comments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT DEFAULT '',
  drive_file_id TEXT DEFAULT '',
  system_name TEXT DEFAULT '',
  description_html TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_contact ON public.tickets (reporter_contact);

-- 9. knowledge_base (คลังความรู้ IT)
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  kb_id TEXT PRIMARY KEY,
  category TEXT DEFAULT '',
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  doc_url TEXT DEFAULT '',
  attachment_name TEXT DEFAULT '',
  attachment_base64 TEXT DEFAULT '',
  attachment_url TEXT DEFAULT '',
  drive_file_id TEXT DEFAULT ''
);

-- 10. email_settings (ตั้งค่าอีเมลแจ้งเตือนและเทมเพลต)
CREATE TABLE IF NOT EXISTS public.email_settings (
  setting_key TEXT PRIMARY KEY,
  json_value JSONB,
  updated_at TEXT DEFAULT ''
);

-- ============================================================================
-- Seed default lookup categories/departments if empty (safe idempotent inserts)
-- ============================================================================
INSERT INTO public.categories (category_name) VALUES
  ('Laptop'), ('Monitor'), ('Projector'), ('Adapter'), ('Audio'), ('Tablet'), ('Accessory'), ('Other')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO public.departments (department_name) VALUES
  ('ฝ่ายเทคโนโลยีสารสนเทศ (IT)'),
  ('สำนักเลขาธิการและประสานงาน'),
  ('ฝ่ายสมาชิกสัมพันธ์และการบริการ'),
  ('ฝ่ายส่งเสริมการค้าและเศรษฐกิจระหว่างประเทศ'),
  ('ฝ่ายพัฒนาธุรกิจและนวัตกรรม'),
  ('ฝ่ายประชาสัมพันธ์และสื่อสารองค์กร'),
  ('ฝ่ายการเงินและการบัญชี'),
  ('ฝ่ายทรัพยากรบุคคล (HR)')
ON CONFLICT (department_name) DO NOTHING;

INSERT INTO public.ticket_categories (category_name, sort_order) VALUES
  ('ฮาร์ดแวร์ / เครื่องคอมพิวเตอร์ / จอภาพ', 1),
  ('ซอฟต์แวร์ / MS Office / โปรแกรมทั่วไป', 2),
  ('ระบบเครือข่าย / อินเทอร์เน็ต / Wi-Fi / VPN', 3),
  ('อีเมลองค์กร / บัญชีผู้ใช้งาน / รหัสผ่าน', 4),
  ('เครื่องพิมพ์ / สแกนเนอร์', 5),
  ('ระบบสารสนเทศภายใน / เว็บไซต์', 6),
  ('งานบริการไอทีอื่นๆ', 7)
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO public.internal_systems (system_name, sort_order) VALUES
  ('ระบบเว็บไซต์หลักหอการค้าไทย (thaichamber.or.th)', 1),
  ('ระบบทะเบียนสมาชิกหอการค้าไทย (TCC Member)', 2),
  ('ระบบสารบรรณอิเล็กทรอนิกส์ (e-Document / e-Office)', 3),
  ('ระบบทรัพยากรบุคคล / ลางานออนไลน์ (HRIS / ESS)', 4),
  ('ระบบบัญชีการเงินและงบประมาณ (ERP / SAP)', 5),
  ('ระบบออกหนังสือรับรองถิ่นกำเนิดสินค้า (CO Online)', 6),
  ('ระบบจองห้องประชุมและยานพาหนะ', 7),
  ('ระบบอินทราเน็ตภายใน (TCC Intranet)', 8),
  ('ระบบอื่นๆ (ระบุในรายละเอียด)', 9)
ON CONFLICT (system_name) DO NOTHING;

-- ============================================================================
-- Grant privileges so Supabase REST API (service_role) & backup scripts work
-- ============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;

