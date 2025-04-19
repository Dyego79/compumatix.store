// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHkeB3w6MA-TjkL6ctdQ9Oh3NJjfwWWi8",
  authDomain: "compumatix-456800.firebaseapp.com",
  projectId: "compumatix-456800",
  storageBucket: "compumatix-456800.firebasestorage.app",
  messagingSenderId: "682206178166",
  appId: "1:682206178166:web:ea4914c72597a151a1e857",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
auth.languageCode = "es";

export const firebase = {
  app,
  auth,
};
