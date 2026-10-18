/**
 * @file agent-log.h
 * @brief The shape of the agent's log lines, shared with the terminal that
 *        watches it (`watch.h`).
 *
 * Every line the agent writes to standard error (and so to the journal)
 * starts with its level prefix. The Enrollment lines are a contract with the
 * terminal: the agent logs one when it connects, and one on its first status
 * check after starting even when the state did not change, so a restarted
 * agent always says where its Enrollment stands.
 */
#ifndef PUPPET_AGENT_LOG_H_
#define PUPPET_AGENT_LOG_H_

/** How each log line starts, by level. */
#define AGENT_LOG_INFO_PREFIX    "[info] "
#define AGENT_LOG_WARNING_PREFIX "[warning] "
#define AGENT_LOG_ERROR_PREFIX   "[error] "

/** Start of the `info` message logged while the Device waits for approval. */
#define AGENT_LOG_ENROLLMENT_PENDING "enrollment: pending"

/** Start of the `info` message logged while the Device is approved. */
#define AGENT_LOG_ENROLLMENT_APPROVED "enrollment: approved"

#endif // PUPPET_AGENT_LOG_H_
