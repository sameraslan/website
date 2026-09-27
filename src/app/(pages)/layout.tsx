import { PageFrame } from '@/components/layout/PageFrame';

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return <PageFrame>{children}</PageFrame>;
}
