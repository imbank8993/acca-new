const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const workflow=require('yaml').parse(fs.readFileSync('.github/workflows/deploy.yml','utf8'));
const job=workflow.jobs.deploy,step=job.steps.find(step=>step.uses?.startsWith('appleboy/ssh-action@'));
assert.equal(job.permissions.contents,'read');
assert.equal(step.env.DEPLOY_TOKEN,'${{ github.token }}');
for(const name of ['DEPLOY_TOKEN','DEPLOY_REPOSITORY','DEPLOY_SHA'])assert(step.with.envs.split(',').includes(name));
assert(!/git fetch origin main/.test(step.with.script));
const dir=path.resolve('scratch/deploy-auth-check');fs.mkdirSync(dir,{recursive:true});
const script=step.with.script.replace('cd /www/wwwroot/acca-new','cd .');
fs.writeFileSync(path.join(dir,'deployment.sh'),script);
const fetchScript=script.slice(0,script.indexOf('echo "🐳 Build Docker..."'));
const fixture=`#!/usr/bin/env bash
set -eu
export DEPLOY_TOKEN='dummy-token-only-for-local-test'
export DEPLOY_REPOSITORY='example/repository'
export DEPLOY_SHA='1111111111111111111111111111111111111111'
git() {
  case "$1" in
    fetch)
      test "$2" = '--no-tags'
      test "$3" = 'https://github.com/example/repository.git'
      test "$4" = "$DEPLOY_SHA"
      test "$GIT_TERMINAL_PROMPT" = '0'
      test "$GIT_CONFIG_COUNT" = '3'
      test "$GIT_CONFIG_VALUE_0" = ''
      test "$GIT_CONFIG_VALUE_1" = ''
      expected="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$DEPLOY_TOKEN" | base64 | tr -d '\\n')"
      test "$GIT_CONFIG_VALUE_2" = "$expected"
      if test "\${FAIL_FETCH:-0}" = 1; then return 128; fi
      ;;
    reset) test "$2" = '--hard'; test "$3" = "$DEPLOY_SHA" ;;
    *) return 99 ;;
  esac
}
${fetchScript}
test -z "\${DEPLOY_TOKEN+x}"
test -z "\${GIT_CONFIG_COUNT+x}"
test -z "\${GIT_CONFIG_VALUE_2+x}"
printf '%s\\n' 'Passed: ephemeral credentials, canonical repository URL, pinned commit and token cleanup.'
`;
fs.writeFileSync(path.join(dir,'fixture.sh'),fixture);
console.log('Passed: workflow syntax, minimal token permissions and explicit SSH environment forwarding.');
