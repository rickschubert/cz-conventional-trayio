'format cjs';

var wrap = require('word-wrap');
var map = require('lodash.map');
var longest = require('longest');
var rightPad = require('right-pad');
var chalk = require('chalk');

var filter = function(array) {
  return array.filter(function(x) {
    return x;
  });
};

var jiraIssuePrefixes = [
  'USP',
  'ESP',
  'PSD',
  'QA',
  'SYS',
  'PSP',
]

var headerLength = function(answers) {
  return (
    answers.type.length + 2 + (answers.scope ? answers.scope.length + 2 : 0)
  );
};

var maxSummaryLength = function(options, answers) {
  return options.maxHeaderWidth - headerLength(answers);
};

var filterSubject = function(subject) {
  subject = subject.trim();
  if (subject.charAt(0).toLowerCase() !== subject.charAt(0)) {
    subject =
      subject.charAt(0).toLowerCase() + subject.slice(1, subject.length);
  }
  while (subject.endsWith('.')) {
    subject = subject.slice(0, subject.length - 1);
  }
  return subject;
};

// This can be any kind of SystemJS compatible module.
// We use Commonjs here, but ES6 or AMD would do just
// fine.
module.exports = function(options) {
  var types = options.types;

  var length = longest(Object.keys(types)).length + 1;
  var choices = map(types, function(type, key) {
    return {
      name: rightPad(key + ':', length) + ' ' + type.description,
      value: key
    };
  });

  return {
    // When a user runs `git cz`, prompter will
    // be executed. We pass you cz, which currently
    // is just an instance of inquirer.js. Using
    // this you can ask questions and get answers.
    //
    // The commit callback should be executed when
    // you're ready to send back a commit template
    // to git.
    //
    // By default, we'll de-indent your commit
    // template and will keep empty lines.
    prompter: function(cz, commit) {
      // Let's ask some questions of the user
      // so that we can populate our commit
      // template.
      //
      // See inquirer.js docs for specifics.
      // You can also opt to use another input
      // collection library if you prefer.
      cz.prompt([
        {
          type: 'list',
          name: 'type',
          message: "Select the type of change that you're committing:",
          choices: choices,
          default: options.defaultType
        },
        {
          type: 'input',
          name: 'scope',
          message:
            'What is the scope of this change (e.g. component or file name): (press enter to skip)',
          default: options.defaultScope,
          filter: function(value) {
            return value.trim().toLowerCase();
          }
        },
        {
          type: 'input',
          name: 'jira',
          message:
            'What is the Jira issue ID for this commit (e.g. USP-123)',
          default: options.defaultJira,
          filter: function(value) {
            return value.trim().toUpperCase();
          },
          validate: function(subject, answers) {
            var filteredSubject = filterSubject(subject);
            var jiraIssueRegEx = /((?!([A-Z0-9a-z]{1,10})-?$)[A-Z]{1}[A-Z0-9]+-\d+)/g;
            return filteredSubject.length == 0
              ? 'Jira issue ID is required'
              : !jiraIssueRegEx.test(filteredSubject)
              ? 'Jira issue doesn\'t match the correct format'
              : !jiraIssuePrefixes.includes(filteredSubject.split('-')[0].toUpperCase())
              ? 'Jira issue doesn\'t match the approved list of prefixes ([' + jiraIssuePrefixes.join() + '])'
              : true;
          }
        },
        {
          type: 'input',
          name: 'subject',
          message: function(answers) {
            return (
              'Write a short, imperative tense description of the change (max ' +
              maxSummaryLength(options, answers) +
              ' chars):\n'
            );
          },
          default: options.defaultSubject,
          validate: function(subject, answers) {
            var filteredSubject = filterSubject(subject);
            return filteredSubject.length == 0
              ? 'subject is required'
              : filteredSubject.length <= maxSummaryLength(options, answers)
              ? true
              : 'Subject length must be less than or equal to ' +
                maxSummaryLength(options, answers) +
                ' characters. Current length is ' +
                filteredSubject.length +
                ' characters.';
          },
          transformer: function(subject, answers) {
            var filteredSubject = filterSubject(subject);
            var color =
              filteredSubject.length <= maxSummaryLength(options, answers)
                ? chalk.green
                : chalk.red;
            return color('(' + filteredSubject.length + ') ' + subject);
          },
          filter: function(subject) {
            return filterSubject(subject);
          }
        },
        {
          type: 'input',
          name: 'body',
          message:
            'Provide a longer description of the change: (press enter to skip)\n',
          default: options.defaultBody
        },
      ]).then(function(answers) {
        var wrapOptions = {
          trim: true,
          cut: false,
          newline: '\n',
          indent: '',
          width: options.maxLineWidth
        };

        // parentheses are only needed when a scope is present
        var scope = answers.scope ? '(' + answers.scope + ')' : '';
        
        var jira = '[' + answers.jira + ']';

        // Hard limit this line in the validate
        var head = answers.type + scope + ': ' + jira + ' ' + answers.subject;

        // Wrap these lines at options.maxLineWidth characters
        var body = answers.body ? wrap(answers.body, wrapOptions) : false;

        // Apply breaking change prefix, removing it if already present
        var breaking = false

        var issues = answers.issues ? wrap(answers.issues, wrapOptions) : false;

        commit(filter([head, body, breaking, issues]).join('\n\n'));
      });
    }
  };
};
