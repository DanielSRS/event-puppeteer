#include "installation/installation.h"
#include "testing/testing.h"

#include <string.h>

#define INSTALLATION_TEST_INVOCATION "9f1c0b2e4a6d4c7e8b3a5d1f2e6c4b7a"

static InstallationInputs installationTestAgentInputs(void) {
  return (InstallationInputs){
    .invocationIdentifier = INSTALLATION_TEST_INVOCATION,
    .executablePath       = CONFIG_BINARY_PATH,
  };
}

static void installationRunsTheAgentUnderSystemd(TestContext *context) {
  const InstallationInputs inputs = installationTestAgentInputs();

  EXPECT(context, InstallationI.decideRole(&inputs) == INSTALLATION_ROLE_AGENT);
}

static void installationNeverMakesATerminalTheAgent(TestContext *context) {
  /** Started by systemd, but from some other copy of the binary. */
  InstallationInputs fromAnotherPath = installationTestAgentInputs();
  fromAnotherPath.executablePath     = "/media/usb/puppet";
  EXPECT(
    context,
    InstallationI.decideRole(&fromAnotherPath) == INSTALLATION_ROLE_TERMINAL
  );

  /** The installed binary, but run by hand. */
  InstallationInputs byHand   = installationTestAgentInputs();
  byHand.invocationIdentifier = NULL;
  EXPECT(
    context, InstallationI.decideRole(&byHand) == INSTALLATION_ROLE_TERMINAL
  );

  InstallationInputs emptyInvocation   = installationTestAgentInputs();
  emptyInvocation.invocationIdentifier = "";
  EXPECT(
    context,
    InstallationI.decideRole(&emptyInvocation) == INSTALLATION_ROLE_TERMINAL
  );

  /** A path that merely starts with the installed one is not the same file. */
  InstallationInputs longerPath = installationTestAgentInputs();
  longerPath.executablePath     = CONFIG_BINARY_PATH ".installing";
  EXPECT(
    context, InstallationI.decideRole(&longerPath) == INSTALLATION_ROLE_TERMINAL
  );
}

static InstallationRepairs installationTestDiagnose(
  const bool binaryValid, const bool unitMatches, const bool serviceEnabled
) {
  const InstallationFacts facts = {
    .binaryValid    = binaryValid,
    .unitMatches    = unitMatches,
    .serviceEnabled = serviceEnabled,
  };
  return InstallationI.diagnose(&facts);
}

static void installationRepairsNothingWhenAllThreePiecesMatch(TestContext *context) {
  const InstallationRepairs repairs = installationTestDiagnose(true, true, true);

  EXPECT(context, !repairs.binary && !repairs.unit && !repairs.enablement);
  EXPECT(context, !InstallationI.needsRepair(&repairs));
}

static void installationRepairsEachPieceOnItsOwn(TestContext *context) {
  const InstallationRepairs binary = installationTestDiagnose(false, true, true);
  EXPECT(context, binary.binary && !binary.unit && !binary.enablement);

  const InstallationRepairs unit = installationTestDiagnose(true, false, true);
  EXPECT(context, !unit.binary && unit.unit && !unit.enablement);

  const InstallationRepairs enablement = installationTestDiagnose(true, true, false);
  EXPECT(context, !enablement.binary && !enablement.unit && enablement.enablement);
}

static void installationDecidesEnablementOnlyOnceTheUnitIsRight(TestContext *context) {
  /** Without the unit systemd cannot say whether it is enabled. */
  const InstallationRepairs unitAndService = installationTestDiagnose(true, false, false);
  EXPECT(context, unitAndService.unit && !unitAndService.enablement);

  const InstallationRepairs everything = installationTestDiagnose(false, false, false);
  EXPECT(context, everything.binary && everything.unit && !everything.enablement);

  const InstallationRepairs binaryAndUnit = installationTestDiagnose(false, false, true);
  EXPECT(context, binaryAndUnit.binary && binaryAndUnit.unit && !binaryAndUnit.enablement);

  const InstallationRepairs binaryAndService = installationTestDiagnose(false, true, false);
  EXPECT(context, binaryAndService.binary && !binaryAndService.unit && binaryAndService.enablement);
}

/** One bit per piece: the eight combinations of valid and diverging. */
#define INSTALLATION_TEST_BINARY_BIT   ((uint32_t)1)
#define INSTALLATION_TEST_UNIT_BIT     ((uint32_t)2)
#define INSTALLATION_TEST_SERVICE_BIT  ((uint32_t)4)
#define INSTALLATION_TEST_COMBINATIONS ((uint32_t)8)

static void installationNeedsRepairForEveryDivergence(TestContext *context) {
  for (uint32_t combination = 0; combination < INSTALLATION_TEST_COMBINATIONS; combination++) {
    const bool binaryValid    = (combination & INSTALLATION_TEST_BINARY_BIT) != 0;
    const bool unitMatches    = (combination & INSTALLATION_TEST_UNIT_BIT) != 0;
    const bool serviceEnabled = (combination & INSTALLATION_TEST_SERVICE_BIT) != 0;
    const InstallationRepairs repairs =
      installationTestDiagnose(binaryValid, unitMatches, serviceEnabled);
    const bool intact = binaryValid && unitMatches && serviceEnabled;

    EXPECT(context, InstallationI.needsRepair(&repairs) == !intact);
  }
}

static void installationRecognizesOnlyTheExpectedUnit(TestContext *context) {
  char unit[INSTALLATION_UNIT_CAPACITY];
  InstallationI.formatUnit(unit, sizeof(unit));
  const size_t length = strlen(unit);

  EXPECT(context, InstallationI.isExpectedUnit(unit, length));
  EXPECT(context, !InstallationI.isExpectedUnit(unit, length - 1));
  EXPECT(context, !InstallationI.isExpectedUnit(unit, 0));

  char edited[INSTALLATION_UNIT_CAPACITY];
  memcpy(edited, unit, length + 1);
  edited[length - 2] = 'X';
  EXPECT(context, !InstallationI.isExpectedUnit(edited, length));

  char longer[INSTALLATION_UNIT_CAPACITY];
  memcpy(longer, unit, length);
  longer[length] = '\n';
  EXPECT(context, !InstallationI.isExpectedUnit(longer, length + 1));
}

static void installationWritesTheExpectedUnit(TestContext *context) {
  char unit[INSTALLATION_UNIT_CAPACITY];

  EXPECT(
    context,
    InstallationI.formatUnit(unit, sizeof(unit)) == INSTALLATION_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(
      unit,
      "[Unit]\n"
      "Description=DSRS Puppet\n"
      "After=network-online.target\n"
      "Wants=network-online.target\n"
      "\n"
      "[Service]\n"
      "Type=simple\n"
      "User=root\n"
      "ExecStart=/opt/dsrs-puppet/puppet\n"
      "Restart=always\n"
      "RestartSec=5\n"
      "\n"
      "[Install]\n"
      "WantedBy=multi-user.target\n"
    ) == 0
  );
}

static void installationRejectsAUnitThatDoesNotFit(TestContext *context) {
  char unit[16];

  EXPECT(
    context,
    InstallationI.formatUnit(unit, sizeof(unit))
      == INSTALLATION_ERROR_UNIT_BUFFER_TOO_SMALL
  );
}

/** The arguments of a run from the technician's home, and of a hostile path. */
static const char *const INSTALLATION_TEST_RUN[]         = {"/home/ana/puppet"};
static const char *const INSTALLATION_TEST_HOSTILE_RUN[] = {"/tmp/o'; rm -rf x/puppet"};

static void installationSetsTheTechnicianForRoot(TestContext *context) {
  char command[INSTALLATION_SU_COMMAND_CAPACITY];

  EXPECT(
    context,
    InstallationI.formatSuCommand(command, sizeof(command), "ana", INSTALLATION_TEST_RUN, 1)
      == INSTALLATION_RESULT_OK
  );
  EXPECT(context, strcmp(command, "SUDO_USER='ana' '/home/ana/puppet'") == 0);
}

static void installationKeepsTheArgumentsThroughSu(TestContext *context) {
  char              command[INSTALLATION_SU_COMMAND_CAPACITY];
  const char *const arguments[] = {"/home/ana/puppet", "first", "two words"};

  EXPECT(
    context,
    InstallationI.formatSuCommand(command, sizeof(command), "ana", arguments, 3)
      == INSTALLATION_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(command, "SUDO_USER='ana' '/home/ana/puppet' 'first' 'two words'") == 0
  );
}

static void installationQuotesWhatTheShellWouldInterpret(TestContext *context) {
  char command[INSTALLATION_SU_COMMAND_CAPACITY];

  EXPECT(
    context,
    InstallationI.formatSuCommand(command, sizeof(command), "a b", INSTALLATION_TEST_HOSTILE_RUN, 1)
      == INSTALLATION_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(command, "SUDO_USER='a b' '/tmp/o'\\''; rm -rf x/puppet'") == 0
  );
}

static void installationRejectsASuCommandThatDoesNotFit(TestContext *context) {
  char command[16];

  EXPECT(
    context,
    InstallationI.formatSuCommand(command, sizeof(command), "ana", INSTALLATION_TEST_RUN, 1)
      == INSTALLATION_ERROR_SU_COMMAND_TOO_LONG
  );
}

static const TestCase INSTALLATION_TEST_CASES[] = {
  {"runs the agent when systemd starts the installed binary", installationRunsTheAgentUnderSystemd},
  {"never makes a terminal run the agent", installationNeverMakesATerminalTheAgent},
  {"repairs nothing when all three pieces match", installationRepairsNothingWhenAllThreePiecesMatch},
  {"repairs each diverging piece on its own", installationRepairsEachPieceOnItsOwn},
  {"decides enablement only once the unit is right", installationDecidesEnablementOnlyOnceTheUnitIsRight},
  {"needs repair for every divergence and only then", installationNeedsRepairForEveryDivergence},
  {"recognizes only the expected unit", installationRecognizesOnlyTheExpectedUnit},
  {"writes the expected unit", installationWritesTheExpectedUnit},
  {"rejects a unit that does not fit instead of truncating", installationRejectsAUnitThatDoesNotFit},
  {"hands the technician's name to root through su", installationSetsTheTechnicianForRoot},
  {"keeps the arguments through su", installationKeepsTheArgumentsThroughSu},
  {"quotes the path and the name for the shell", installationQuotesWhatTheShellWouldInterpret},
  {"rejects a su command that does not fit instead of truncating", installationRejectsASuCommandThatDoesNotFit},
};

static const TestSuite InstallationTestSuite = {
  .name      = "installation",
  .cases     = INSTALLATION_TEST_CASES,
  .caseCount = sizeof(INSTALLATION_TEST_CASES) / sizeof(INSTALLATION_TEST_CASES[0]),
};
