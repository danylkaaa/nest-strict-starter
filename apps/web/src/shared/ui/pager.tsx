import { Button, HStack, Text } from '@chakra-ui/react';

import { pageNumbers } from '@/shared/page-numbers';

interface PagerProps {
  onChange: (page: number) => void;
  page: number;
  totalPages: number;
}

export const Pager = ({ onChange, page, totalPages }: PagerProps) => (
  <HStack colorPalette="blue" gap="1">
    <Button
      disabled={page <= 1}
      onClick={() => {
        onChange(page - 1);
      }}
      size="sm"
      variant="outline"
    >
      ‹ Prev
    </Button>
    {pageNumbers(page, totalPages).map((entry, index, entries) =>
      entry === 'gap' ? (
        // A gap is identified by the page number shown before it
        <Text color="fg.subtle" key={`gap-after-${String(entries[index - 1])}`} px="2">
          …
        </Text>
      ) : (
        <Button
          aria-current={entry === page ? 'page' : undefined}
          key={entry}
          minW="9"
          onClick={() => {
            onChange(entry);
          }}
          size="sm"
          variant={entry === page ? 'solid' : 'outline'}
        >
          {entry}
        </Button>
      ),
    )}
    <Button
      disabled={page >= totalPages}
      onClick={() => {
        onChange(page + 1);
      }}
      size="sm"
      variant="outline"
    >
      Next ›
    </Button>
  </HStack>
);
