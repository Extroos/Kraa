// Integration test script to verify Firestore persistence
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runPersistenceTest() {
  console.log('--- Starting Persistence Test ---');
  const testOwnerId = 'test-owner-' + Date.now();
  const testPropName = 'Persistence Test Prop ' + Date.now();

  try {
    // 1. Create
    console.log('1. Creating property...');
    const docRef = await addDoc(collection(db, 'properties'), {
      name: testPropName,
      address: '123 Test St',
      city: 'Test City',
      ownerId: testOwnerId,
      createdAt: new Date().toISOString()
    });
    console.log('   PASSED: Created with ID:', docRef.id);

    // 2. Read (Verify persistence)
    console.log('2. Verifying persistence...');
    const q = query(collection(db, 'properties'), where('ownerId', '==', testOwnerId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('Verification FAILED: Property not found in database after write.');
    }
    
    const found = snapshot.docs[0].data();
    if (found.name !== testPropName) {
      throw new Error(`Verification FAILED: Name mismatch. Expected ${testPropName}, got ${found.name}`);
    }
    console.log('   PASSED: Property found and data matches.');

    // 3. Cleanup
    console.log('3. Cleaning up...');
    await deleteDoc(doc(db, 'properties', docRef.id));
    console.log('   PASSED: Cleaned up test data.');

    console.log('--- ALL PERSISTENCE TESTS PASSED ---');
    process.exit(0);
  } catch (error) {
    console.error('--- TEST FAILED ---');
    console.error(error);
    process.exit(1);
  }
}

runPersistenceTest();
