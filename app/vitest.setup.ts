// test-setup.ts
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

export default function setup() {
  // Firebaseの初期化
  const app = initializeApp({
    apiKey: "AIzaSyCrKUREPHnXIDzmDsUQDxSiFoDO2-lxfvk",
    authDomain: "ui-kit.firebaseapp.com",
    projectId: "enostech-sandbox",
    storageBucket: "enostech-sandbox.appspot.com",
    appId: "1:190589658964:web:74a293c70b71ef6d030ac1",
  });

  // Firestoreの初期化
  const db = getFirestore(app);

  // Firestoreエミュレータへの接続
  connectFirestoreEmulator(db, "localhost", 8080);
}
