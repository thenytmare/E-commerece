import { getHomepageSections } from '@/lib/homepage';
import { DismissibleAnnouncement } from './DismissibleAnnouncement';

/** Site-wide announcement strip, controlled from Admin → Homepage Builder. */
export async function AnnouncementBar() {
  const sections = await getHomepageSections();
  const message = sections.announcements.message.trim();

  if (!sections.announcements.enabled || !message) {
    return null;
  }

  return <DismissibleAnnouncement message={message} />;
}
