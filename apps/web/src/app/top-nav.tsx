import { Box, Button, Flex, HStack, Link, Menu, Portal } from '@chakra-ui/react';
import { Link as RouterLink, NavLink, useLocation } from 'react-router';

const RESULT_ITEMS = [
  { label: 'Aircraft reports', to: '/reports' },
  { label: 'Emails', to: '/emails' },
  { label: 'Webhooks', to: '/webhooks' },
] as const;

const linkStyle = {
  _currentPage: { borderColor: 'blue.500', color: 'blue.600', fontWeight: 'semibold' },
  _hover: { color: 'blue.600', textDecoration: 'none' },
  borderBottomWidth: '2px',
  borderColor: 'transparent',
  color: 'fg.muted',
  h: 'full',
  px: '3.5',
} as const;

const NavItem = ({ end, label, to }: { end: boolean; label: string; to: string }) => (
  <Link {...linkStyle} asChild display="flex" alignItems="center">
    <NavLink end={end} to={to}>
      {label}
    </NavLink>
  </Link>
);

// The Results menu is "current" while any of its pages is open
const ResultsMenu = () => {
  const { pathname } = useLocation();
  const current = RESULT_ITEMS.some(({ to }) => pathname.startsWith(to));
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Link
          {...linkStyle}
          alignItems="center"
          aria-current={current ? 'page' : undefined}
          as="button"
          cursor="pointer"
          display="flex"
          gap="1"
        >
          Results <span aria-hidden>▾</span>
        </Link>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {RESULT_ITEMS.map(({ label, to }) => (
              <Menu.Item asChild key={to} value={to}>
                <RouterLink to={to}>{label}</RouterLink>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const TopNav = () => (
  <Box as="header" bg="bg" borderBottomWidth="1px">
    <Flex align="center" h="60px" maxW="1200px" mx="auto" px="7">
      <HStack as="nav" gap="0" h="full">
        <NavItem end label="Dashboard" to="/" />
        <ResultsMenu />
        <NavItem end={false} label="Jobs" to="/jobs" />
      </HStack>
      <Button asChild colorPalette="blue" ms="auto">
        <RouterLink to="/submit">Add job</RouterLink>
      </Button>
    </Flex>
  </Box>
);
