package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

func insertTestDashboard(title string, accountId int64, tags ...interface{}) *m.Dashboard {
	cmd := m.SaveDashboardCommand{
		AccountId: accountId,
		Dashboard: map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		},
	}

	err := SaveDashboard(&cmd)
	So(err, ShouldBeNil)

	return cmd.Result
}

func TestDashboardDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given saved dashboard", func() {
			savedDash := insertTestDashboard("test dash 23", 1, "prod", "webapp")

			Convey("Should return dashboard model", func() {
				So(savedDash.Title, ShouldEqual, "test dash 23")
				So(savedDash.Slug, ShouldEqual, "test-dash-23")
				So(savedDash.Id, ShouldNotEqual, 0)
			})

			Convey("Should be able to get dashboard", func() {
				query := m.GetDashboardQuery{
					Slug:      "test-dash-23",
					AccountId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
			})

			Convey("Should be able to search for dashboard", func() {
				query := m.SearchDashboardsQuery{
					Title:     "%test%",
					AccountId: 1,
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				hit := query.Result[0]
				So(len(hit.Tags), ShouldEqual, 2)
			})

			Convey("Should be able to search for dashboards using tags", func() {
				query1 := m.SearchDashboardsQuery{Tag: "webapp", AccountId: 1}
				query2 := m.SearchDashboardsQuery{Tag: "tagdoesnotexist", AccountId: 1}

				err := SearchDashboards(&query1)
				err = SearchDashboards(&query2)
				So(err, ShouldBeNil)

				So(len(query1.Result), ShouldEqual, 1)
				So(len(query2.Result), ShouldEqual, 0)
			})

			Convey("Should not be able to save dashboard with same name", func() {
				cmd := m.SaveDashboardCommand{
					AccountId: 1,
					Dashboard: map[string]interface{}{
						"id":    nil,
						"title": "test dash 23",
						"tags":  []interface{}{},
					},
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Should be able to get dashboard tags", func() {
				query := m.GetDashboardTagsQuery{AccountId: 1}

				err := GetDashboardTags(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
			})

			Convey("Given two dashboards, one is starred dashboard by user 10, other starred by user 1", func() {
				starredDash := insertTestDashboard("starred dash", 1)
				StarDashboard(&m.StarDashboardCommand{
					DashboardId: starredDash.Id,
					UserId:      10,
				})

				StarDashboard(&m.StarDashboardCommand{
					DashboardId: savedDash.Id,
					UserId:      1,
				})

				Convey("Should be able to search for starred dashboards", func() {
					query := m.SearchDashboardsQuery{AccountId: 1, UserId: 10, IsStarred: true}
					err := SearchDashboards(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Title, ShouldEqual, "starred dash")
				})
			})
		})
	})
}
