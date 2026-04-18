import { redirect } from 'next/navigation';

// Legacy path kept only so external links keep working; the V2 explorer is
// now the canonical /orderedmap.
export default function OrderedMapV2Redirect() {
  redirect('/orderedmap');
}
