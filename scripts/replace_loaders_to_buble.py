import os
import re

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXCLUDE_DIRS = {'.git', 'node_modules', '.next', 'dist', 'build', '.turbo', 'backups'}

def process_files():
    modified_files = []
    total_replacements = 0

    print(f"Scanning directory: {ROOT_DIR}")

    for root, dirs, files in os.walk(ROOT_DIR, topdown=True):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file in files:
            if not file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                continue

            new_content = content
            file_replacements = 0

            # 1. Replace variant="trace" and variant='trace'
            matches_trace_double = len(re.findall(r'variant="trace"', new_content))
            matches_trace_single = len(re.findall(r"variant='trace'", new_content))
            if matches_trace_double > 0:
                new_content = re.sub(r'variant="trace"', 'variant="buble"', new_content)
                file_replacements += matches_trace_double
            if matches_trace_single > 0:
                new_content = re.sub(r"variant='trace'", "variant='buble'", new_content)
                file_replacements += matches_trace_single

            # 2. Replace variant="dots" and variant='dots'
            matches_dots_double = len(re.findall(r'variant="dots"', new_content))
            matches_dots_single = len(re.findall(r"variant='dots'", new_content))
            if matches_dots_double > 0:
                new_content = re.sub(r'variant="dots"', 'variant="buble"', new_content)
                file_replacements += matches_dots_double
            if matches_dots_single > 0:
                new_content = re.sub(r"variant='dots'", "variant='buble'", new_content)
                file_replacements += matches_dots_single

            # 3. Special handling for Spinner.tsx to set default resolvedVariant and PageLoader default
            if file == 'Spinner.tsx' and 'components' in root:
                # Update resolvedVariant default logic to buble
                old_resolved = "const resolvedVariant: SpinnerVariant = variant ?? (dotsOnly ? 'buble' : 'trace');"
                new_resolved = "const resolvedVariant: SpinnerVariant = (variant === 'trace' ? 'buble' : variant) ?? 'buble';"
                if old_resolved in new_content:
                    new_content = new_content.replace(old_resolved, new_resolved)
                    file_replacements += 1

                # Update PageLoader JSDoc and defaults
                old_page_loader_comment = "* PageLoader — loader area/halaman penuh, default variant trace."
                new_page_loader_comment = "* PageLoader — loader area/halaman penuh, default variant buble."
                if old_page_loader_comment in new_content:
                    new_content = new_content.replace(old_page_loader_comment, new_page_loader_comment)
                    file_replacements += 1

                old_page_loader_sig = "export function PageLoader({ label, minHeight, dotsOnly = false, variant, size }:"
                new_page_loader_sig = "export function PageLoader({ label, minHeight, dotsOnly = false, variant = 'buble', size }:"
                if old_page_loader_sig in new_content:
                    new_content = new_content.replace(old_page_loader_sig, new_page_loader_sig)
                    file_replacements += 1

            if file_replacements > 0 and new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                rel_path = os.path.relpath(file_path, ROOT_DIR)
                modified_files.append((rel_path, file_replacements))
                total_replacements += file_replacements

    print(f"\n[SUCCESS] Completed replacing loaders to 'buble'.")
    print(f"Total files updated: {len(modified_files)}")
    print(f"Total replacements: {total_replacements}\n")
    print("Modified files:")
    for rel_path, count in modified_files:
        print(f"  - {rel_path} ({count} replacements)")

if __name__ == '__main__':
    process_files()
