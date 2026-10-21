"""Generate synthetic planning examples. This performs no transfer operations."""
import copy
import json
from pathlib import Path


def profiles():
    resource = {'id': 'agent-workspace', 'kind': 'workspace', 'materialization': 'snapshot-copy',
        'targetRole': 'destination-working', 'access': 'read-write', 'sharingGroup': None,
        'sourcePath': 'C:/Office/Agent_A', 'destinationPath': 'C:/Office/Agent_A'}
    baseline = {'version': 1, 'name': 'exclusive-original-paths',
        'sourceStore': 'source-machine:codex:store-a', 'destinationStore': 'destination-machine:codex:store-b',
        'continuity': {'intent': 'exclusive-continuation', 'sourceWriter': 'stopped'},
        'identity': {'policy': 'retain-exclusive', 'sourceSession': 'example-parent', 'destinationSession': 'example-parent'},
        'history': {'binding': 'snapshot-copy', 'writerAuthority': 'destination-exclusive', 'resourceId': 'primary-history'},
        'cwd': {'logicalPolicy': 'original', 'namespace': 'host', 'requestedPath': 'C:/Office/Agent_A', 'extent': 'selected-closure'},
        'instructions': 'preserve', 'tools': 'pin-source', 'topology': 'require-verified-native',
        'resources': [resource, {'id': 'primary-history', 'kind': 'history', 'materialization': 'snapshot-copy',
            'targetRole': 'destination-working', 'access': 'read-write', 'sharingGroup': None,
            'sourcePath': 'source-store:/sessions/example-parent', 'destinationPath': 'destination-store:/sessions/example-parent'}],
        'references': [{'consumer': 'workspace-relative references', 'basis': 'cwd-relative', 'resolution': 'preserve-layout', 'status': 'unverified'}],
        'capabilities': {'historyCoordination': 'unneeded', 'evidence': [], 'requiredAcceptance': 'unverified'},
        'executionReady': False, 'blockers': ['Planning preset; checkpoint, dependency closure, namespace collisions, and adapter acceptance need verification.']}
    result = [baseline]
    source_history = copy.deepcopy(baseline)
    source_history['name'] = 'source-linked-history-copied-workspace-candidate'
    source_history['history']['binding'] = 'linked-live-file'
    source_history['resources'][0]['availability'] = 'local-independent'
    source_history['resources'][1].update(materialization='symlink', targetRole='recovery-source',
        sharingGroup='attached-source-history', availability='source-volume-required',
        sourcePath='D:/Users/example/.codex/sessions/example-parent.jsonl',
        destinationPath='C:/Users/example/.codex/sessions/example-parent.jsonl')
    source_history['blockers'] = ['Candidate only: Codex indexing, canonical path selection, append, replacement, archive, restart, and disconnect behavior through a linked tape are unverified.',
        'A resumed writer may mutate the source-volume target. Recovery-source write access is not authorized by this candidate.',
        'The destination must also resolve its own harness index and every required child tape, attachment, and other dependency.']
    result.append(source_history)
    linked_portal = copy.deepcopy(baseline)
    linked_portal['name'] = 'exclusive-original-paths-linked-workspace'
    linked_portal['resources'][0]['sharingGroup'] = 'destination-agent-a-replica'
    linked_portal['resources'].append({'id': 'workspace-portal', 'kind': 'workspace',
        'materialization': 'symlink', 'targetRole': 'destination-working', 'access': 'read-write',
        'sharingGroup': 'destination-agent-a-replica', 'sourcePath': 'C:/Office/Agent_A',
        'destinationPath': 'C:/Transfers/example-parent/workspace'})
    linked_portal['blockers'] = ['Verify the exact-path replica and its link are the same filesystem resource; compare lexical and canonical cwd plus instruction ancestry before allowing alias-path launch.']
    result.append(linked_portal)
    relocated = copy.deepcopy(baseline)
    relocated['name'] = 'exclusive-remapped-paths'
    relocated['cwd'].update(logicalPolicy='remapped', requestedPath='C:/AgentSystems/Agent_A')
    relocated['resources'][0]['destinationPath'] = relocated['cwd']['requestedPath']
    relocated['instructions'] = 'overlay'
    relocated['references'].append({'consumer': 'old absolute paths', 'basis': 'absolute', 'resolution': 'configure', 'status': 'unverified'})
    result.append(relocated)
    fork = copy.deepcopy(relocated)
    fork['name'] = 'independent-fork'
    fork['continuity'].update(intent='fork', sourceWriter='active')
    fork['identity'].update(policy='native-fork-id', destinationSession=None)
    fork['history']['binding'] = 'native-fork'
    fork['resources'][1]['materialization'] = 'native-harness'
    fork['resources'][1]['destinationPath'] = 'destination-store:/sessions/<native-fork-id>'
    fork['cwd']['requestedPath'] = 'C:/AgentSystems/Agent_A_branch'
    fork['resources'][0]['destinationPath'] = fork['cwd']['requestedPath']
    fork['blockers'] = ['Adapter must allocate a native fork ID, verify separate history appends and workspace independence, and inventory shared external effects.']
    result.append(fork)
    shared = copy.deepcopy(fork)
    shared['name'] = 'fork-shared-embodiment'
    shared['resources'][0].update(materialization='symlink', targetRole='shared-live', sharingGroup='agent-a-shared-workspace')
    shared['blockers'] = ['Independent histories are intended; filesystem edits are intentionally coupled. Verify link target, concurrent-write behavior, and shared services.']
    result.append(shared)
    readonly = copy.deepcopy(fork)
    readonly['name'] = 'fork-readonly-shared-references'
    readonly['resources'].append({'id': 'common-learning-library', 'kind': 'identity-memory',
        'materialization': 'symlink', 'targetRole': 'shared-live', 'access': 'read-only',
        'sharingGroup': 'shared-learning-library', 'sourcePath': 'C:/Shared/Learning',
        'destinationPath': 'C:/AgentSystems/Agent_A_branch/references'})
    readonly['blockers'] = ['Verify independent histories and workspaces; establish read-only enforcement for the shared reference library. A symlink alone does not enforce it.']
    result.append(readonly)
    extended = copy.deepcopy(relocated)
    extended['name'] = 'extended-access-candidate'
    extended['continuity'].update(intent='extended-access', sourceWriter='active')
    extended['identity']['policy'] = 'retain-namespaced'
    extended['sourceStore'] = extended['destinationStore'] = 'coordinated-service:example-lineage'
    extended['history'].update(binding='coordinated-service', writerAuthority='harness-coordinated')
    extended['resources'][0].update(materialization='service-reference', targetRole='shared-live', sharingGroup='coordinated-agent-workspace')
    extended['resources'][1].update(materialization='service-reference', targetRole='shared-live', sharingGroup='coordinated-agent-history', destinationPath='coordinated-service:/example-lineage')
    extended['capabilities']['historyCoordination'] = 'unknown'
    extended['blockers'] = ['Candidate only: a harness/service must demonstrate coordinated history and writer semantics. No such adapter has been validated here.']
    result.append(extended)
    lens = copy.deepcopy(baseline)
    lens['name'] = 'readonly-history-lens'
    lens['continuity'].update(intent='archive', sourceWriter='active')
    lens['identity']['policy'] = 'retain-namespaced'
    lens['history'].update(binding='snapshot-copy', writerAuthority='none')
    lens['resources'][0].update(access='read-only', targetRole='preserved-evidence')
    lens['resources'][1].update(access='read-only', targetRole='preserved-evidence')
    lens['blockers'] = ['Verify a consistent snapshot and read-only enforcement; no continuation writer is authorized by this profile.']
    result.append(lens)
    return result


def main():
    target = Path(__file__).resolve().parent / 'examples'
    target.mkdir(exist_ok=True)
    for profile in profiles():
        (target / (profile['name'] + '.json')).write_text(json.dumps(profile, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(profiles())} synthetic candidate profiles; no runtime changes.')


if __name__ == '__main__':
    main()
