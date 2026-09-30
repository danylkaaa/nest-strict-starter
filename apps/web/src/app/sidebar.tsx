import { Box, Heading, Link, Stack } from '@chakra-ui/react';
import { NavLink } from 'react-router';

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Emails', to: '/emails' },
] as const;

export const Sidebar = () => (
  <Box as="nav" bg="bg.muted" borderRightWidth="1px" flexShrink="0" p="4" w="60">
    <Heading mb="6" px="3" size="md">
      Web
    </Heading>
    <Stack gap="1">
      {NAV_ITEMS.map(({ label, to }) => (
        <Link
          _currentPage={{ bg: 'bg.emphasized', fontWeight: 'semibold' }}
          _hover={{ bg: 'bg.subtle', textDecoration: 'none' }}
          asChild
          borderRadius="md"
          key={to}
          px="3"
          py="2"
        >
          <NavLink end to={to}>
            {label}
          </NavLink>
        </Link>
      ))}
    </Stack>
  </Box>
);
