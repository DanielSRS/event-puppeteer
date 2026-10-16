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

static void installationClassifiesWhatIsInstalled(TestContext *context) {
  EXPECT(
    context,
    InstallationI.classify(false, false) == INSTALLATION_STATE_ABSENT
  );
  EXPECT(
    context, InstallationI.classify(true, true) == INSTALLATION_STATE_PRESENT
  );
  EXPECT(
    context, InstallationI.classify(true, false) == INSTALLATION_STATE_PARTIAL
  );
  EXPECT(
    context, InstallationI.classify(false, true) == INSTALLATION_STATE_PARTIAL
  );
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

static void installationUsesSudoForAnAdministrativeGroupMember(TestContext *context) {
  const char *const sudoGroups[]  = {"users", "sudo"};
  const char *const wheelGroups[] = {"wheel"};

  EXPECT(context, InstallationI.chooseElevation(sudoGroups, 2) == INSTALLATION_ELEVATION_SUDO);
  EXPECT(context, InstallationI.chooseElevation(wheelGroups, 1) == INSTALLATION_ELEVATION_SUDO);
}

static void installationUsesSuForAnyoneElse(TestContext *context) {
  const char *const lookalikes[] = {"users", "sudoers", "Sudo", "wheels"};

  EXPECT(context, InstallationI.chooseElevation(lookalikes, 4) == INSTALLATION_ELEVATION_SU);
  EXPECT(context, InstallationI.chooseElevation(lookalikes, 0) == INSTALLATION_ELEVATION_SU);
}

static void installationSetsTheTechnicianForRoot(TestContext *context) {
  char command[INSTALLATION_SU_COMMAND_CAPACITY];

  EXPECT(
    context,
    InstallationI.formatSuCommand(command, sizeof(command), "/home/ana/puppet", "ana")
      == INSTALLATION_RESULT_OK
  );
  EXPECT(context, strcmp(command, "SUDO_USER='ana' '/home/ana/puppet'") == 0);
}

static void installationQuotesWhatTheShellWouldInterpret(TestContext *context) {
  char command[INSTALLATION_SU_COMMAND_CAPACITY];

  EXPECT(
    context,
    InstallationI.formatSuCommand(command, sizeof(command), "/tmp/o'; rm -rf x/puppet", "a b")
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
    InstallationI.formatSuCommand(command, sizeof(command), "/home/ana/puppet", "ana")
      == INSTALLATION_ERROR_SU_COMMAND_TOO_LONG
  );
}

static const TestCase INSTALLATION_TEST_CASES[] = {
  {"runs the agent when systemd starts the installed binary", installationRunsTheAgentUnderSystemd},
  {"never makes a terminal run the agent", installationNeverMakesATerminalTheAgent},
  {"classifies what is installed", installationClassifiesWhatIsInstalled},
  {"writes the expected unit", installationWritesTheExpectedUnit},
  {"rejects a unit that does not fit instead of truncating", installationRejectsAUnitThatDoesNotFit},
  {"uses sudo for members of an administrative group", installationUsesSudoForAnAdministrativeGroupMember},
  {"uses su for everyone else", installationUsesSuForAnyoneElse},
  {"hands the technician's name to root through su", installationSetsTheTechnicianForRoot},
  {"quotes the path and the name for the shell", installationQuotesWhatTheShellWouldInterpret},
  {"rejects a su command that does not fit instead of truncating", installationRejectsASuCommandThatDoesNotFit},
};

static const TestSuite InstallationTestSuite = {
  .name      = "installation",
  .cases     = INSTALLATION_TEST_CASES,
  .caseCount = sizeof(INSTALLATION_TEST_CASES) / sizeof(INSTALLATION_TEST_CASES[0]),
};
