import { Button, Center, Heading, HStack, Spinner, Stack, Text } from '@chakra-ui/react';

import { EmailList } from './email-list';
import { useEmailsStore } from './emails-store';
import { useEmailsPage } from './use-emails-page';

export const EmailsPage = () => {
  const { expandedId, nextPage, page, prevPage, setExpandedId } = useEmailsStore();
  const { data, isError, isPlaceholderData } = useEmailsPage(page);

  if (isError) {
    return <Text color="fg.error">Could not load emails.</Text>;
  }

  if (data === undefined) {
    return (
      <Center py="10">
        <Spinner />
      </Center>
    );
  }

  return (
    <Stack gap="4">
      <Heading size="2xl">Emails</Heading>
      <EmailList emails={data.items} expandedId={expandedId} onExpandedChange={setExpandedId} />
      <HStack justify="space-between">
        <Text color="fg.muted" fontSize="sm">
          Page {data.page} of {data.totalPages} · {data.total} emails
        </Text>
        <HStack>
          <Button disabled={page <= 1} onClick={prevPage} size="sm" variant="outline">
            Previous
          </Button>
          <Button
            disabled={isPlaceholderData || page >= data.totalPages}
            onClick={nextPage}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </HStack>
      </HStack>
    </Stack>
  );
};
