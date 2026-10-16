import { db } from '../data/db.js';

export function notifyStudents(message, title = 'Allotment update', studentIds = null) {
  const recipients = studentIds ? new Set(studentIds) : null;
  const students = db.find('users', user =>
    user.role === 'student' && (!recipients || recipients.has(user.id))
  );
  if (students.length === 0) return [];

  const timestamp = new Date().toISOString();
  const notifications = db.getCollection('notifications');
  const created = students.map((student, index) => ({
    id: `notif-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`,
    recipientRole: 'student',
    recipientId: student.id,
    title,
    message,
    timestamp,
    read: false
  }));

  notifications.push(...created);
  db.save();
  return created;
}
