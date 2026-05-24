namespace Ledgerra.Domain.Imports;

public enum ImportRuleMatchOperator
{
    Contains = 1,
    Equals = 2,
    StartsWith = 3,
    Regex = 4,
    GreaterThan = 5,
    LessThan = 6,
    Between = 7,
    NotContains = 8,
    NotEquals = 9
}
