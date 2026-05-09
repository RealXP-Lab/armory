using System;
using SQLite;

namespace QuestJournal.SQLData
{
    [Table("Objective")]
    public record ObjectiveData(
        int Id,
        bool Enabled,
        long InputDate,
        [property: Column("quest_id"), Indexed] int QuestId,
        [property: Column("description")] string Description,
        [property: Column("target_progress")] int TargetProgress
    )  : SQLiteData(Id, Enabled, InputDate)
    {
        public ObjectiveData() : this(0, true, DateTime.Now.Ticks, 0, string.Empty, 0) { }
    }
}