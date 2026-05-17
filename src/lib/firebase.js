import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Using the config provided in your prompt
const firebaseConfig = {
  apiKey: "AIzaSyCKEzWLnRVt-JoSAB7jd2kbdtWeOy-z8JA",
  authDomain: "mpl-id-7e5ec.firebaseapp.com",
  databaseURL: "https://mpl-id-7e5ec-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "mpl-id-7e5ec",
  storageBucket: "mpl-id-7e5ec.firebasestorage.app",
  messagingSenderId: "967812870494",
  appId: "1:967812870494:web:d4f1effc746341d7379fcf",
  measurementId: "G-6YNMHT6L3X"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
