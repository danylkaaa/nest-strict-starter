# Job queue

The application accepts individual jobs and groups of jobs whose progress is shown together.

## Language

**Job**:
A single queued unit of work with its own outcome, attempts, and activity.

**Batch**:
An ordered group of newly submitted jobs that shares one schedule and cancellation request. A batch is not itself a job and cannot contain another batch.

**Child job**:
A job created as part of one batch. It retains the behavior and result of its own job type.

**Batch progress**:
The proportion of child jobs with a terminal outcome, including completed, failed, and cancelled children.

**Cancellation request**:
The instruction to prevent unstarted child jobs from running while allowing work already in progress to finish.
