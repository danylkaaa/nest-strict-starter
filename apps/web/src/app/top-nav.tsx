import { Box, Flex, HStack, Link, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router';

const NAV_ITEMS = [
  { end: true, label: 'Dashboard', to: '/' },
  { end: false, label: 'Jobs', to: '/jobs' },
  { end: false, label: 'Emails', to: '/emails' },
  { end: false, label: 'Submit', to: '/submit' },
] as const;

export const TopNav = () => (
  <Box as="header" bg="bg" borderBottomWidth="1px">
    <Flex align="center" h="60px" maxW="1200px" mx="auto" px="7">
      <Text color="blue.700" fontSize="lg" fontWeight="bold" mr="auto">
        Jobqueue
      </Text>
      <HStack as="nav" gap="0" h="full">
        {NAV_ITEMS.map(({ end, label, to }) => (
          <Link
            _currentPage={{ borderColor: 'blue.500', color: 'blue.600', fontWeight: 'semibold' }}
            _hover={{ color: 'blue.600', textDecoration: 'none' }}
            asChild
            borderBottomWidth="2px"
            borderColor="transparent"
            color="fg.muted"
            h="full"
            key={to}
            px="3.5"
          >
            <NavLink end={end} to={to}>
              {label}
            </NavLink>
          </Link>
        ))}
      </HStack>
    </Flex>
  </Box>
);
