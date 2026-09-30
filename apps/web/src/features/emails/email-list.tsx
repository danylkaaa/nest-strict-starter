import { Accordion, Box, Grid, Text } from '@chakra-ui/react';

import { formatTimestamp, shortenId } from './format';

import type { Email } from './email';

const COLUMNS = '2fr 3fr 1fr 1.5fr auto';

interface EmailListProps {
  emails: readonly Email[];
  expandedId: string | null;
  onExpandedChange: (id: string | null) => void;
}

export const EmailList = ({ emails, expandedId, onExpandedChange }: EmailListProps) => (
  <Box borderRadius="md" borderWidth="1px">
    <Grid
      bg="bg.muted"
      color="fg.muted"
      fontSize="sm"
      fontWeight="semibold"
      gap="4"
      px="4"
      py="2"
      templateColumns={COLUMNS}
    >
      <Text>Recipient</Text>
      <Text>Subject</Text>
      <Text>ID</Text>
      <Text>Sent</Text>
      <Box w="4" />
    </Grid>
    <Accordion.Root
      collapsible
      onValueChange={({ value }) => {
        onExpandedChange(value[0] ?? null);
      }}
      value={expandedId === null ? [] : [expandedId]}
      variant="plain"
    >
      {emails.map((email) => (
        <Accordion.Item borderTopWidth="1px" key={email.id} value={email.id}>
          <Accordion.ItemTrigger _hover={{ bg: 'bg.subtle' }} cursor="pointer" px="4">
            <Grid flex="1" fontSize="sm" gap="4" templateColumns={COLUMNS} textAlign="left">
              <Text truncate>{email.recipient}</Text>
              <Text fontWeight="medium" truncate>
                {email.subject}
              </Text>
              <Text fontFamily="mono" title={email.id}>
                {shortenId(email.id)}
              </Text>
              <Text color="fg.muted">{formatTimestamp(email.sentAt)}</Text>
            </Grid>
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody px="4">
              <Text whiteSpace="pre-wrap">{email.body}</Text>
            </Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  </Box>
);
