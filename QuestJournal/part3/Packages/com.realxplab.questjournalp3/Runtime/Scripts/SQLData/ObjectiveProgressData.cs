using System;
using SQLite;

namespace QuestJournal.SQLData
{
    [Table("ObjectiveProgress")]
    public record ObjectiveProgressData(
        int Id,
        bool Enabled,
        long InputDate,
        [property: Column("objective_id"), Indexed] int ObjectiveId,
        [property: Column("current_progress")] int CurrentProgress
    ) : SQLiteData(Id, Enabled, InputDate)
    {
        public ObjectiveProgressData() : this(0, true, DateTime.Now.Ticks, 0, 0) { }
    }
}