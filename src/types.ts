/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'organizer' | 'attendee';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  bio?: string;
}

export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  imageUrl?: string;
  price: number;
  totalCapacity: number;
  remainingCapacity: number;
  organizerId: string;
  status: EventStatus;
  category: string;
  highlights?: string[];
  attendanceCount?: number;
  schedule?: { time: string; activity: string }[];
  createdAt: string;
}

export type RegistrationStatus = 'confirmed' | 'cancelled' | 'pending_payment';

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  purchaseDate: string;
  status: RegistrationStatus;
  ticketId?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
}

export type WaitlistStatus = 'waiting' | 'notified' | 'expired' | 'converted';

export interface WaitlistEntry {
  id: string;
  eventId: string;
  attendeeId: string;
  joinedAt: string;
  status: WaitlistStatus;
  notificationSentAt?: string;
  deadlineAt?: string;
}

export interface Analytics {
  totalRevenue: number;
  ticketsSold: number;
  waitlistCount: number;
  demographics: {
    label: string;
    value: number;
  }[];
}

export type CollaborationRole = 'owner' | 'marketing' | 'ticketing' | 'logistics';

export interface EventCollaboration {
  id: string;
  eventId: string;
  userId: string;
  role: CollaborationRole;
  assignedAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  assignedTo?: string; // userId
  role?: CollaborationRole; // task category/role
  status: TaskStatus;
  deadline?: string;
}
