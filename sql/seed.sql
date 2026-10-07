insert into public.clubs (name, description) values
  ('CU Computer Club', 'Where code meets creativity.'),
  ('CU Cultural Club', 'Celebrating arts and heritage.'),
  ('CU Debating Society', 'Sharpen your arguments.'),
  ('CU Robotics Club', 'Build the future with metal and code.'),
  ('CU Photography Club', 'Capture moments that matter.'),
  ('CU Sports Club', 'Health, hustle and campus spirit.'),
  ('CU Business Club', 'Entrepreneurship at campus scale.'),
  ('CU Rotaract Club', 'Service above self.')
on conflict (name) do nothing;

insert into public.departments (name) values
  ('CSE'),
  ('EEE'),
  ('BBA'),
  ('English'),
  ('Civil Engineering')
on conflict (name) do nothing;

insert into public.courses (department_id, semester, code, title)
select d.id, c.semester, c.code, c.title
from (values
  ('CSE', 1, 'CSE 101', 'Introduction to Programming'),
  ('CSE', 1, 'CSE 102', 'Discrete Mathematics'),
  ('CSE', 1, 'CSE 103', 'Digital Logic Design'),
  ('CSE', 1, 'CSE 104', 'English for Computing'),
  ('CSE', 2, 'CSE 201', 'Data Structures'),
  ('CSE', 2, 'CSE 202', 'Object-Oriented Programming'),
  ('CSE', 2, 'CSE 203', 'Computer Architecture'),
  ('CSE', 2, 'CSE 204', 'Calculus and Linear Algebra'),
  ('CSE', 3, 'CSE 301', 'Algorithms'),
  ('CSE', 3, 'CSE 302', 'Theory of Computation'),
  ('CSE', 3, 'CSE 303', 'Database Systems'),
  ('CSE', 3, 'CSE 304', 'Software Engineering'),
  ('CSE', 4, 'CSE 401', 'Operating Systems'),
  ('CSE', 4, 'CSE 402', 'Computer Networks'),
  ('CSE', 4, 'CSE 403', 'Web Technologies'),
  ('CSE', 4, 'CSE 404', 'Probability and Statistics'),
  ('CSE', 5, 'CSE 501', 'Compiler Design'),
  ('CSE', 5, 'CSE 502', 'Machine Learning'),
  ('CSE', 5, 'CSE 503', 'Information Security'),
  ('CSE', 5, 'CSE 504', 'Mobile Application Development'),
  ('EEE', 1, 'EEE 101', 'Electrical Circuits I'),
  ('EEE', 1, 'EEE 102', 'Engineering Mathematics I'),
  ('EEE', 2, 'EEE 201', 'Electronics I'),
  ('EEE', 2, 'EEE 202', 'Electrical Machines I'),
  ('BBA', 1, 'BBA 101', 'Principles of Management'),
  ('BBA', 1, 'BBA 102', 'Business Communication'),
  ('BBA', 2, 'BBA 201', 'Marketing Fundamentals'),
  ('BBA', 2, 'BBA 202', 'Financial Accounting')
) as c(department_name, semester, code, title)
join public.departments d on d.name = c.department_name
on conflict (department_id, code) do nothing;

insert into public.events
  (club_id, title, description, type, starts_at, venue, capacity)
select c.id, seed.title, seed.description, seed.type,
       now() + seed.day_offset * interval '1 day',
       seed.venue, seed.capacity
from (values
  ('CU Computer Club', 'Web Development Workshop', 'A practical introduction to building websites.', 'workshop', 3, 'Room 402, Main Building', 60),
  ('CU Cultural Club', 'Cultural Night', 'An evening of music, dance, and campus performances.', 'cultural', 12, 'University Auditorium', 400),
  ('CU Debating Society', 'Inter-Department Debate', 'A friendly debate between campus departments.', 'seminar', 5, 'Seminar Hall, Block B', 150),
  ('CU Robotics Club', 'Robo Arena Challenge', 'Build, test, and race a student-designed robot.', 'competition', 20, 'Engineering Lab, Block C', 80),
  ('CU Photography Club', 'Golden Hour Photowalk', 'Explore campus photography at sunset.', 'social', 2, 'Campus Garden', null),
  ('CU Sports Club', 'Inter-Batch Football', 'Register a team for the campus tournament.', 'sports', 8, 'Sports Field', 200),
  ('CU Business Club', 'Student Startup Pitch', 'Present an idea to a friendly panel of mentors.', 'competition', 15, 'Conference Room, Admin Block', 100),
  ('CU Rotaract Club', 'Campus Blood Donation Drive', 'A voluntary campus donation event.', 'general', 1, 'Medical Center', null),
  ('CU Computer Club', 'Hackathon 2.0', 'A 24-hour team building challenge.', 'competition', -10, 'Computer Lab, Block A', 120),
  ('CU Cultural Club', 'Freshers Welcome', 'Welcome event for new students.', 'social', -20, 'University Auditorium', 500),
  ('CU Debating Society', 'Public Speaking Practice', 'A practice session for new speakers.', 'workshop', -5, 'Seminar Hall, Block B', 1)
) as seed(club_name, title, description, type, day_offset, venue, capacity)
join public.clubs c on c.name = seed.club_name
where not exists (
  select 1 from public.events existing where existing.title = seed.title
);
