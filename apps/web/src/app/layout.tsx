import { Box, Flex } from '@chakra-ui/react';
import { Outlet } from 'react-router';

import { Sidebar } from './sidebar';

export const Layout = () => (
  <Flex h="100vh">
    <Sidebar />
    <Box as="main" flex="1" overflowY="auto" p="8">
      <Outlet />
    </Box>
  </Flex>
);
