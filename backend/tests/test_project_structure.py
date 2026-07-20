import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from app.projects.project_structure import (
    CONFIRMATION_REQUIRED,
    PENDING_PROJECT,
    SUSPECTED_SUBDIRECTORY,
    classify_project_directory,
    looks_like_project_root,
)


class ProjectStructureTests(unittest.TestCase):
    def test_project_root_and_standard_subdirectory_are_classified(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_root = Path(temp_dir) / "示例展厅"
            project_root.mkdir()
            for name in ("00_项目档案", "01_项目前期资料", "02_需求资料", "03_CAD图纸"):
                (project_root / name).mkdir()

            self.assertTrue(looks_like_project_root(project_root))
            self.assertEqual(classify_project_directory(project_root).category, PENDING_PROJECT)
            self.assertEqual(
                classify_project_directory(project_root / "03_CAD图纸").category,
                SUSPECTED_SUBDIRECTORY,
            )

    def test_unstructured_directory_requires_confirmation(self) -> None:
        with TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir) / "旧项目"
            directory.mkdir()

            structure = classify_project_directory(directory)

            self.assertEqual(structure.category, CONFIRMATION_REQUIRED)
            self.assertTrue(structure.requires_confirmation)


if __name__ == "__main__":
    unittest.main()
