import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace these placeholder values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCdELBJUj_V0g5qIutoZYXahYD0p1_pdw4",
  authDomain: "rapid-crisis-response-94158.firebaseapp.com",
  databaseURL: "https://rapid-crisis-response-94158-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "rapid-crisis-response-94158",
  storageBucket: "rapid-crisis-response-94158.firebasestorage.app",
  messagingSenderId: "899786083796",
  appId: "1:899786083796:web:2b57ef2b7ce9c2db741a41"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const firestore = getFirestore(app);

export { app, auth, database, firestore };
