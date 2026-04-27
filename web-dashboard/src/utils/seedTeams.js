/**
 * seedTeams.js — Seeds 3 default responder teams directly into Firestore.
 * Does NOT create Firebase Auth accounts (which would sign out the current admin).
 * Members use deterministic UIDs based on their email.
 *
 * Usage: import { seed } from './seedTeams'; await seed();
 */

import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const TEAMS = [
  {
    id: 'team_alpha',
    name: 'Team Alpha',
    priority: 1,
    vehicle: '🚑',
    status: 'ready',
    members: [
      { email: 'team1.doctor@reliefmesh.com',    role: 'Doctor',    name: 'Dr. Arjun Mehta' },
      { email: 'team1.nurse@reliefmesh.com',      role: 'Nurse',     name: 'Priya Sharma' },
      { email: 'team1.paramedic@reliefmesh.com',  role: 'Paramedic', name: 'Rahul Verma' },
      { email: 'team1.driver@reliefmesh.com',     role: 'Driver',    name: 'Sunil Patil' },
    ],
  },
  {
    id: 'team_bravo',
    name: 'Team Bravo',
    priority: 2,
    vehicle: '🚑',
    status: 'ready',
    members: [
      { email: 'team2.doctor@reliefmesh.com',    role: 'Doctor',    name: 'Dr. Kavita Iyer' },
      { email: 'team2.nurse@reliefmesh.com',      role: 'Nurse',     name: 'Anita Desai' },
      { email: 'team2.paramedic@reliefmesh.com',  role: 'Paramedic', name: 'Vikram Singh' },
      { email: 'team2.driver@reliefmesh.com',     role: 'Driver',    name: 'Manoj Kulkarni' },
    ],
  },
  {
    id: 'team_charlie',
    name: 'Team Charlie',
    priority: 3,
    vehicle: '🚑',
    status: 'ready',
    members: [
      { email: 'team3.doctor@reliefmesh.com',    role: 'Doctor',    name: 'Dr. Neha Joshi' },
      { email: 'team3.nurse@reliefmesh.com',      role: 'Nurse',     name: 'Deepika Rao' },
      { email: 'team3.paramedic@reliefmesh.com',  role: 'Paramedic', name: 'Amit Thakur' },
      { email: 'team3.driver@reliefmesh.com',     role: 'Driver',    name: 'Rajesh Gupta' },
    ],
  },
];

export async function seed() {
  console.log('🚀 Starting team seed...');

  // First, clear any existing teams with random IDs (from addDoc)
  try {
    const existingSnap = await getDocs(collection(db, 'teams'));
    const deletePromises = [];
    existingSnap.forEach((d) => {
      // Delete teams that aren't our seeded ones (random ID teams)
      if (!['team_alpha', 'team_bravo', 'team_charlie'].includes(d.id)) {
        deletePromises.push(deleteDoc(doc(db, 'teams', d.id)));
      }
    });
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`🗑️ Cleared ${deletePromises.length} old team(s)`);
    }
  } catch (e) {
    console.warn('Could not clear old teams:', e.message);
  }

  for (const team of TEAMS) {
    const memberDocs = [];

    for (const member of team.members) {
      // Use deterministic UID based on email (no auth account creation needed)
      const uid = member.email.replace(/[@.]/g, '_');

      // Write user doc
      await setDoc(doc(db, 'users', uid), {
        displayName: member.name,
        email: member.email,
        role: 'Responder',
        teamId: team.id,
        teamRole: member.role,
      }, { merge: true });

      // Write responder doc
      await setDoc(doc(db, 'responders', uid), {
        name: member.name,
        email: member.email,
        role: member.role,
        teamId: team.id,
        available: true,
        lat: 19.0760 + (Math.random() - 0.5) * 0.05,
        lng: 72.8777 + (Math.random() - 0.5) * 0.05,
      }, { merge: true });

      memberDocs.push({ uid, role: member.role, name: member.name, email: member.email });
    }

    // Write team doc with filled members
    await setDoc(doc(db, 'teams', team.id), {
      name: team.name,
      priority: team.priority,
      vehicle: team.vehicle,
      status: team.status,
      members: memberDocs,
      dispatchedSosId: null,
      createdAt: Date.now(),
    }, { merge: true });

    console.log(`✅ Team "${team.name}" seeded with ${memberDocs.length} members`);
  }

  console.log('🎉 All 3 teams seeded with 12 members!');
  console.log('📋 Credentials — All accounts use password: Relief123');
}

export default seed;
