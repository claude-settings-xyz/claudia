import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

// The homepage is about settings.json, so its title says so. The docs keep the Claudia title.
export default function Layout({ children }: LayoutProps<'/'>) {
  const options = baseOptions();
  return (
    <HomeLayout {...options} nav={{ ...options.nav, title: <span className="font-mono font-semibold">settings.json</span> }}>
      {children}
    </HomeLayout>
  );
}
