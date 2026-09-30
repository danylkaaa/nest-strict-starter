import { Box, Flex, Heading, HStack, Text } from '@chakra-ui/react';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  actions?: ReactNode;
  badge?: ReactNode;
  mono?: boolean;
  subtitle?: ReactNode;
  title: ReactNode;
}

export const PageHeader = ({ actions, badge, mono = false, subtitle, title }: PageHeaderProps) => (
  <Flex align="flex-start" gap="4" justify="space-between">
    <Box>
      <HStack gap="3">
        <Heading
          as="h1"
          fontFamily={mono ? 'mono' : undefined}
          fontWeight={mono ? 'semibold' : 'bold'}
          size="3xl"
        >
          {title}
        </Heading>
        {badge}
      </HStack>
      {subtitle !== undefined && (
        <Text color="fg.muted" mt="1">
          {subtitle}
        </Text>
      )}
    </Box>
    {actions !== undefined && <HStack gap="2">{actions}</HStack>}
  </Flex>
);
