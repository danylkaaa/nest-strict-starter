import { Box, Button, Flex, HStack, NativeSelect, Stack, Text } from '@chakra-ui/react';

import { MAX_BATCH_TASKS, newTaskForm } from './submit-form';
import { TaskFields } from './task-fields';
import { TASK_TYPE_OPTIONS, toTaskType } from './task-types';

import type { TaskForm } from './submit-form';

interface BatchTasksProps {
  airportOptions: readonly (readonly [string, string])[];
  newId: () => string;
  onChange: (update: (tasks: TaskForm[]) => TaskForm[]) => void;
  tasks: readonly TaskForm[];
}

/** Editable list of batch tasks; each task picks its own type */
export const BatchTasks = ({ airportOptions, newId, onChange, tasks }: BatchTasksProps) => {
  const updateTask = (id: string, update: (task: TaskForm) => TaskForm) => {
    onChange((current) => current.map((task) => (task.id === id ? update(task) : task)));
  };
  const lastType = tasks.at(-1)?.type ?? 'email';

  return (
    <Stack gap="3">
      {tasks.map((task, index) => (
        <Box bg="gray.50" borderRadius="md" borderWidth="1px" key={task.id} p="4">
          <Flex align="center" gap="3" mb="3">
            <Text fontWeight="semibold">Task {index + 1}</Text>
            <NativeSelect.Root bg="bg" size="sm" w="180px">
              <NativeSelect.Field
                aria-label={`Task ${index + 1} type`}
                onChange={(event) => {
                  const type = toTaskType(event.currentTarget.value);
                  if (type !== undefined) updateTask(task.id, (current) => ({ ...current, type }));
                }}
                value={task.type}
              >
                {TASK_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Button
              colorPalette="red"
              disabled={tasks.length === 1}
              ms="auto"
              onClick={() => {
                onChange((current) => current.filter((item) => item.id !== task.id));
              }}
              size="xs"
              variant="ghost"
            >
              Remove
            </Button>
          </Flex>
          <Stack gap="3">
            <TaskFields
              airportOptions={airportOptions}
              onChange={(update) => {
                updateTask(task.id, update);
              }}
              task={task}
            />
          </Stack>
        </Box>
      ))}
      <HStack gap="3">
        <Button
          colorPalette="blue"
          disabled={tasks.length >= MAX_BATCH_TASKS}
          onClick={() => {
            onChange((current) => [...current, newTaskForm(lastType, newId())]);
          }}
          size="sm"
          variant="outline"
        >
          + Add task
        </Button>
        <Text color="fg.muted" fontSize="sm">
          {tasks.length} of {MAX_BATCH_TASKS} tasks
        </Text>
      </HStack>
    </Stack>
  );
};
