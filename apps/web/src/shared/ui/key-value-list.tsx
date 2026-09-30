import { Box, Grid, Text } from '@chakra-ui/react';
import { Fragment } from 'react';

import type { ReactNode } from 'react';

export interface KeyValue {
  label: string;
  mono?: boolean;
  value: ReactNode;
}

export const KeyValueList = ({ items }: { items: readonly KeyValue[] }) => (
  <Grid as="dl" columnGap="5" m="0" rowGap="2" templateColumns="auto 1fr">
    {items.map((item) => (
      <Fragment key={item.label}>
        <Text as="dt" color="fg.muted">
          {item.label}
        </Text>
        <Box
          as="dd"
          fontFamily={item.mono === true ? 'mono' : undefined}
          fontSize={item.mono === true ? 'xs' : undefined}
          m="0"
          alignSelf="center"
        >
          {item.value}
        </Box>
      </Fragment>
    ))}
  </Grid>
);
