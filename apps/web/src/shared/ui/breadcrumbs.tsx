import { Breadcrumb } from '@chakra-ui/react';
import { Fragment } from 'react';
import { Link as RouterLink } from 'react-router';

export interface Crumb {
  label: string;
  mono?: boolean;
  to?: string;
}

export const Breadcrumbs = ({ items }: { items: readonly Crumb[] }) => (
  <Breadcrumb.Root>
    <Breadcrumb.List>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <Breadcrumb.Separator />}
          <Breadcrumb.Item fontFamily={item.mono === true ? 'mono' : undefined}>
            {item.to === undefined ? (
              <Breadcrumb.CurrentLink fontWeight="medium">{item.label}</Breadcrumb.CurrentLink>
            ) : (
              <Breadcrumb.Link asChild>
                <RouterLink to={item.to}>{item.label}</RouterLink>
              </Breadcrumb.Link>
            )}
          </Breadcrumb.Item>
        </Fragment>
      ))}
    </Breadcrumb.List>
  </Breadcrumb.Root>
);
