import { validateCollection } from './metrics.js';

export async function loadStudy() {
  const snapshotResponse = await fetch(`${import.meta.env.BASE_URL}data/study.json`);
  if (!snapshotResponse.ok) throw new Error('The processed study snapshot is unavailable.');
  const snapshot = await snapshotResponse.json();
  validateCollection(snapshot.routes, 100, 'route_id', 'MultiLineString');
  if (snapshot.centres?.features?.length !== 11 || snapshot.legs?.length !== 533) {
    throw new Error('The processed study snapshot is incomplete.');
  }
  return { routes: snapshot.routes, centres: snapshot.centres, legs: snapshot.legs,
    source: 'Validated static publication snapshot', hashes: snapshot.source_sha256 };
}
