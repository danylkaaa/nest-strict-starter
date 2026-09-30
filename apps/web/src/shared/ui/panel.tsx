import { Box, Flex, Text } from '@chakra-ui/react';

import type { BoxProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface PanelProps extends Omit<BoxProps, 'title'> {
  extra?: ReactNode;
  title?: ReactNode;
}

/** White bordered card used for every content block in the design */
export const Panel = ({ children, extra, title, ...rest }: PanelProps) => (
  <Box bg="bg" borderRadius="lg" borderWidth="1px" px="5" py="4" {...rest}>
    {title !== undefined && (
      <Flex align="baseline" gap="2" mb="3">
        <Text fontSize="md" fontWeight="semibold">
          {title}
        </Text>
        {extra !== undefined && (
          <Text color="fg.muted" fontSize="sm">
            {extra}
          </Text>
        )}
      </Flex>
    )}
    {children}
  </Box>
);
