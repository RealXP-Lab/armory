using System.Collections.Generic;
using System.Linq;
using QuestJournal.Services;
using QuestJournal.SQLData;
using UnityEngine;

namespace QuestJournal.Controllers
{
    public class SQLiteController : MonoBehaviour
    {
        const string DataBaseName = "QuestJournal";

        SQLiteService sqliteService;

        void Awake()
        {
            sqliteService = new SQLiteService(DataBaseName);
            CreateTables();
        }

        void OnDestroy()
        {
            sqliteService?.Dispose();
        }

        void CreateTables()
        {
            sqliteService.CreateTable<QuestData>();
            sqliteService.CreateTable<QuestProgressData>();
            sqliteService.CreateTable<ObjectiveData>();
            sqliteService.CreateTable<ObjectiveProgressData>();
        }

        public void InsertQuest(QuestData quest) => sqliteService.Insert(quest);

        public QuestData GetQuest(int id) => sqliteService.Find<QuestData>(id);

        public void InsertObjective(ObjectiveData objective) => sqliteService.Insert(objective);

        public List<ObjectiveData> GetObjectivesForQuest(int questId) => sqliteService.GetAllBy<ObjectiveData>(o => o.QuestId == questId && o.Enabled);

        public bool IsQuestTableEmpty() => sqliteService.IsTableEmpty<QuestData>();

        public void StartQuest(QuestData quest)
        {
            var progress = new QuestProgressData { QuestId = quest.Id };
            sqliteService.Insert(progress);
        }

        public void CompleteQuest(QuestProgressData progress)
        {
            var completedQuest = progress with { IsComplete = true };
            sqliteService.Update(completedQuest);
        }

        public void StartObjective(ObjectiveData objective)
        {
            var progress = new ObjectiveProgressData { ObjectiveId = objective.Id };
            sqliteService.Insert(progress);
        }

        public void UpdateObjectiveProgress(ObjectiveProgressData progress, int currentProgress)
        {
            var updatedProgress = progress with { CurrentProgress = currentProgress };
            sqliteService.Update(updatedProgress);
        }

        public List<QuestData> GetActiveQuests()
        {
            var activeProgress = sqliteService.GetAllBy<QuestProgressData>(
                p => !p.IsComplete && p.Enabled);

            if (activeProgress.Count == 0)
                return new List<QuestData>();

            var activeQuestIds = activeProgress.Select(p => p.QuestId).ToHashSet();

            return sqliteService.GetAll<QuestData>()
                .Where(q => activeQuestIds.Contains(q.Id))
                .ToList();
        }

        public QuestProgressData GetQuestProgressData(int questId)
        {
            return sqliteService.Find<QuestProgressData>(q => q.QuestId == questId);
        }

        public List<(ObjectiveData Objective, ObjectiveProgressData Progress)> GetObjectives(int questId)
        {
            var objectives = sqliteService.GetAllBy<ObjectiveData>(o => o.QuestId == questId && o.Enabled);

            if (objectives.Count == 0)
                return new List<(ObjectiveData, ObjectiveProgressData)>();

            var progressMap = sqliteService.GetAll<ObjectiveProgressData>()
                .ToDictionary(p => p.ObjectiveId);

            return objectives
                .Where(o => progressMap.ContainsKey(o.Id))
                .Select(o => (o, progressMap[o.Id]))
                .ToList();
        }

        public bool IsObjectiveComplete(ObjectiveData objective, ObjectiveProgressData progress) =>
            progress.CurrentProgress >= objective.TargetProgress;
    }
}