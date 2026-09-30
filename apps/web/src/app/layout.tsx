import { Box, Stack } from '@chakra-ui/react';
import { Outlet } from 'react-router';

import { TopNav } from './top-nav';

export const Layout = () => (
  <Box bg="gray.50" minH="100vh">
    <TopNav />
    <Stack as="main" gap="5" maxW="1200px" mx="auto" px="7" py="6">
      <Outlet />
    </Stack>
  </Box>
);
