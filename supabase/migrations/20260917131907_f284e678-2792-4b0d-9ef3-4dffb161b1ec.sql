-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');
CREATE TYPE public.task_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE public.draft_status AS ENUM ('draft', 'approved');
CREATE TYPE public.email_tone AS ENUM ('formal', 'informal', 'persuasive');
CREATE TYPE public.email_audience AS ENUM ('client', 'manager', 'team');

-- shared updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  job_title TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'));
$$;

-- new user bootstrap: profile + default member role (first user becomes admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, job_title)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'job_title')
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO user_count FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN user_count = 0 THEN 'admin'::public.app_role ELSE 'member'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  due_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MEETINGS
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  attendees TEXT[] NOT NULL DEFAULT '{}',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  raw_notes TEXT NOT NULL DEFAULT '',
  summary JSONB,
  summary_status public.draft_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL OR public.is_manager(auth.uid()));
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_manager(auth.uid()));
CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'todo',
  due_date TIMESTAMPTZ,
  estimated_minutes INT,
  assignee_id UUID,
  assignee_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  approval_status public.draft_status NOT NULL DEFAULT 'approved',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL OR assignee_id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_manager(auth.uid()));
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EMAILS
CREATE TABLE public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  recipient_name TEXT,
  recipient_email TEXT,
  tone public.email_tone NOT NULL DEFAULT 'formal',
  audience public.email_audience NOT NULL DEFAULT 'client',
  context TEXT,
  status public.draft_status NOT NULL DEFAULT 'draft',
  is_follow_up BOOLEAN NOT NULL DEFAULT false,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails TO authenticated;
GRANT ALL ON public.emails TO service_role;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emails_select" ON public.emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "emails_insert" ON public.emails FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "emails_update" ON public.emails FOR UPDATE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL OR public.is_manager(auth.uid()));
CREATE POLICY "emails_delete" ON public.emails FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_manager(auth.uid()));
CREATE TRIGGER emails_updated_at BEFORE UPDATE ON public.emails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'reminder',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ACTIVITY LOG
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- SAMPLE DATA
INSERT INTO public.clients (id, name, contact_name, contact_email, phone, status, notes) VALUES
 ('11111111-1111-4111-8111-000000000001', 'Larkfield Group', 'Dana Whitmore', 'dana@larkfield.co', '+27 21 555 0110', 'active', 'Enterprise rollout, two-week review buffer.'),
 ('11111111-1111-4111-8111-000000000002', 'Northwind Logistics', 'Priya Raman', 'priya@northwind.io', '+27 11 555 0142', 'active', 'Contract renewal mid-May.'),
 ('11111111-1111-4111-8111-000000000003', 'Beacon Health', 'Marco Alves', 'marco@beaconhealth.org', '+27 31 555 0188', 'active', 'Sprint demos every second Friday.'),
 ('11111111-1111-4111-8111-000000000004', 'Halcyon Studio', 'Ife Bello', 'ife@halcyon.studio', '+27 21 555 0177', 'at_risk', 'Invoice 4482 outstanding.');

INSERT INTO public.projects (id, name, description, client_id, status, start_date, due_date) VALUES
 ('22222222-2222-4222-8222-000000000001', 'Larkfield onboarding', 'Pilot rollout and access provisioning for the Larkfield team.', '11111111-1111-4111-8111-000000000001', 'active', '2026-08-01', '2026-10-15'),
 ('22222222-2222-4222-8222-000000000002', 'Northwind renewal', 'Contract renewal, revised SOW and NDA countersign.', '11111111-1111-4111-8111-000000000002', 'active', '2026-07-15', '2026-09-30'),
 ('22222222-2222-4222-8222-000000000003', 'Beacon platform sprint', 'Q3 sprint work and demo cadence for Beacon Health.', '11111111-1111-4111-8111-000000000003', 'active', '2026-09-01', '2026-11-20'),
 ('22222222-2222-4222-8222-000000000004', 'Halcyon retainer', 'Monthly retainer work and billing recovery.', '11111111-1111-4111-8111-000000000004', 'on_hold', '2026-06-01', NULL);

INSERT INTO public.meetings (id, title, meeting_date, attendees, client_id, project_id, raw_notes, summary, summary_status) VALUES
 ('33333333-3333-4333-8333-000000000001', 'Larkfield onboarding kickoff', now() - interval '2 days', ARRAY['Dana Whitmore','Kara Osei','Sam Oyelaran'], '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001',
  'Walked through the rollout plan. Dana wants the pilot to land on the 28th so her team keeps a two-week buffer. Access list needs updating; two reviewer names still outstanding. Sam to prepare the sandbox once names are confirmed. Budget unchanged.',
  '{"key_points":["Pilot date moved to the 28th to preserve a two-week review buffer","Access list requires updating before sandbox provisioning","Budget remains unchanged"],"decisions":["Pilot go-live set for the 28th"],"action_items":[{"task":"Confirm two reviewer names","owner":"Dana Whitmore","deadline":"Thursday"},{"task":"Provision sandbox once reviewers confirmed","owner":"Sam Oyelaran","deadline":"Not specified"}],"deadlines":["Pilot go-live: the 28th"],"risks":["Sandbox provisioning blocked until reviewer names arrive"],"not_specified":["Sandbox provisioning date"]}', 'approved'),
 ('33333333-3333-4333-8333-000000000002', 'Northwind contract review', now() - interval '1 day', ARRAY['Priya Raman','Kara Osei'], '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000002',
  'Reviewed redlines on the renewal. Priya flagged the liability clause. Revised SOW to be sent this week. NDA countersign is late on our side.', NULL, 'draft'),
 ('33333333-3333-4333-8333-000000000003', 'Beacon sprint planning', now() - interval '5 days', ARRAY['Marco Alves','Kara Osei','Team'], '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000003',
  'Scoped the next sprint. Demo slot confirmed for the 17th at 10:00. Onboarding checklist needs a review pass.', NULL, 'draft');

INSERT INTO public.tasks (title, description, priority, status, due_date, estimated_minutes, assignee_name, client_id, project_id, meeting_id, source, approval_status) VALUES
 ('Finalise Q3 audit sign-off with Larkfield', 'Collect the remaining signatures and file the audit pack.', 'urgent', 'in_progress', now() + interval '4 hours', 90, 'Kara Osei', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', NULL, 'manual', 'approved'),
 ('Send revised SOW to Northwind Logistics', 'Incorporate the liability clause change and send for review.', 'high', 'todo', now() + interval '8 hours', 45, 'Kara Osei', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000002', 'meeting', 'approved'),
 ('Review onboarding checklist for Beacon Health', 'Check every step against the new sprint scope.', 'medium', 'todo', now() + interval '10 hours', 60, 'Sam Oyelaran', '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000003', '33333333-3333-4333-8333-000000000003', 'meeting', 'approved'),
 ('Log standup notes from AM sync', NULL, 'low', 'done', now() - interval '5 hours', 15, 'Kara Osei', NULL, NULL, NULL, 'manual', 'approved'),
 ('Chase invoice #4482 with Halcyon', 'Second reminder; escalate if no reply.', 'urgent', 'todo', now() - interval '2 days', 20, 'Kara Osei', '11111111-1111-4111-8111-000000000004', '22222222-2222-4222-8222-000000000004', NULL, 'manual', 'approved'),
 ('Submit Northwind NDA countersign', 'Countersign and return the NDA.', 'urgent', 'todo', now() - interval '1 day', 15, 'Kara Osei', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000002', NULL, 'manual', 'approved'),
 ('Draft Halcyon recovery plan', 'Outline a payment plan proposal.', 'high', 'blocked', now() - interval '3 days', 120, 'Sam Oyelaran', '11111111-1111-4111-8111-000000000004', '22222222-2222-4222-8222-000000000004', NULL, 'manual', 'approved'),
 ('Northwind contract renewal package', 'Assemble the full renewal package for signature.', 'high', 'todo', now() + interval '2 days', 180, 'Kara Osei', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000002', NULL, 'manual', 'approved'),
 ('Beacon Health sprint demo', 'Run the sprint demo with Marco and team.', 'medium', 'todo', now() + interval '3 days', 60, 'Kara Osei', '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000003', NULL, 'manual', 'approved'),
 ('Larkfield pilot readout', 'Prepare and present the pilot readout deck.', 'medium', 'todo', now() + interval '5 days', 120, 'Sam Oyelaran', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', NULL, 'manual', 'approved'),
 ('Confirm two reviewer names', 'Follow up with Dana on reviewer names.', 'high', 'todo', now() + interval '1 day', 10, 'Dana Whitmore', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000001', 'meeting', 'approved'),
 ('Provision sandbox once reviewers confirmed', 'Blocked on reviewer names.', 'medium', 'blocked', NULL, 45, 'Sam Oyelaran', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000001', 'meeting', 'draft');

INSERT INTO public.emails (subject, body, recipient_name, recipient_email, tone, audience, context, status, is_follow_up, client_id, project_id, meeting_id) VALUES
 ('Revised onboarding timeline — Larkfield rollout',
  E'Hi Dana,\n\nThanks for the note this morning. We have adjusted the onboarding plan so the Larkfield pilot lands on the 28th, which keeps your team''s two-week buffer intact.\n\nI have attached the revised timeline and the updated access list. Could you confirm the two reviewer names by Thursday so we can lock the sandbox?\n\nTalk soon,\nKara',
  'Dana Whitmore', 'dana@larkfield.co', 'formal', 'client', 'Confirm the revised pilot date and request reviewer names.', 'draft', true,
  '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000001'),
 ('Invoice #4482 — friendly reminder',
  E'Hi Ife,\n\nJust a gentle nudge on invoice #4482, now two days past due. Could you confirm a payment date so I can close it out on our side?\n\nMuch appreciated,\nKara',
  'Ife Bello', 'ife@halcyon.studio', 'informal', 'client', 'Second reminder on the outstanding invoice.', 'draft', false,
  '11111111-1111-4111-8111-000000000004', '22222222-2222-4222-8222-000000000004', NULL),
 ('Sprint demo invite — 17th at 10:00',
  E'Hi Marco,\n\nConfirming the sprint demo for the 17th at 10:00. We will walk through the completed scope and the onboarding checklist changes.\n\nBest,\nKara',
  'Marco Alves', 'marco@beaconhealth.org', 'formal', 'client', 'Confirm the demo slot and agenda.', 'draft', false,
  '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000003', '33333333-3333-4333-8333-000000000003'),
 ('Weekly delivery update', E'Team,\n\nQuick recap of where we stand this week and what needs attention before Friday.\n\nKara', NULL, NULL, 'informal', 'team', 'Weekly internal recap.', 'approved', false, NULL, NULL, NULL);

INSERT INTO public.activity_log (actor_name, action, entity_type, detail) VALUES
 ('Kara Osei', 'approved_summary', 'meeting', 'Approved the summary for Larkfield onboarding kickoff'),
 ('Kara Osei', 'created_email', 'email', 'Drafted "Revised onboarding timeline — Larkfield rollout"'),
 ('Sam Oyelaran', 'completed_task', 'task', 'Marked "Log standup notes from AM sync" as done'),
 ('Kara Osei', 'created_client', 'client', 'Added Halcyon Studio');