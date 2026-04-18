import { redirect } from 'next/navigation';

// Legacy path kept only so external links keep working; the V2 quest viewer
// is now the canonical /quests.
export default function QuestsV2Redirect() {
  redirect('/quests');
}
