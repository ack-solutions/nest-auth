import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <span className="font-semibold">Nest Auth</span>
        <span className="ml-2 rounded bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">
          beta
        </span>
      </>
    ),
  },
  links: [
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
    },
    {
      text: 'API Reference',
      url: '/docs/api-reference',
    },
    {
      text: 'GitHub',
      url: 'https://github.com/ack-solutions/nest-auth',
      external: true,
    },
  ],
};
