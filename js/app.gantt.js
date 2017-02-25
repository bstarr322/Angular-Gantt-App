(function(){

app.directive('dhxGantt', ['$window', function ($window) {
  return {
    restrict: 'A',
    scope: false,
    transclude: true,
    template: '<div ng-transclude></div>',

    link:function ($scope, $element, $attrs, $controller){

      //watch data collection, reload on changes
      $scope.$watch($attrs.data, function(collection){
        gantt.clearAll();
        gantt.parse(collection, "json");
      }, true);

      //Size of gantt
      $scope.$watch(function() {
        return $element[0].offsetWidth + "." + $element[0].offsetHeight;
      }, function() {
        gantt.setSizes();
      });

      // Gantt Settings. Will configure again later.

      // Scale Configuration
      gantt.config.scale_unit = "month";
      gantt.config.step = 1;
      gantt.config.date_scale = "%F, %Y";
      gantt.config.min_column_width = 50;

      gantt.config.scale_height = 90;

      var weekScaleTemplate = function(date){
        var dateToStr = gantt.date.date_to_str("%D %d %M %Y");
        return dateToStr(date);
      };

      gantt.config.subscales = [
        {unit:"week", step:1, template:weekScaleTemplate},
        {unit:"day", step:1, date:"%D" }
      ];

      // Enable Sort
      gantt.config.sort = true; 

      // Baselines
      gantt.config.xml_date = "%Y-%m-%d %H:%i:%s";
      gantt.config.task_height = 16;
      gantt.config.row_height = 40;
      gantt.locale.labels.baseline_enable_button = 'Set';
      gantt.locale.labels.baseline_disable_button = 'Remove';

      gantt.config.lightbox.sections = [
        {name: "description", height: 70, map_to: "text", type: "textarea", focus: true},
        {name: "type", type: "typeselect", map_to: "type"},
        {name: "time", map_to: "auto", type: "duration"},
        {name: "baseline", map_to: { start_date: "planned_start", end_date: "planned_end"},button: true,  type: "duration_optional"}
      ];
      gantt.locale.labels.section_baseline = "Planned";

      // Right side & Left side Text
      gantt.templates.rightside_text = function(start, end, task){
      //   if(task.type == gantt.config.types.milestone){
      //     return task.text;
      //   }
        if (task.planned_end) {
          if (end.getTime() > task.planned_end.getTime()) {
            var overdue = Math.ceil(Math.abs((end.getTime() - task.planned_end.getTime()) / (24 * 60 * 60 * 1000)));
            var text = "<b>Overdue: " + overdue + " days</b>";
            return text;
          }
        }
      };

      // gantt.templates.leftside_text = function(start, end, task){
      //   if(task.type != gantt.config.types.milestone){
      //     return task.text;
      //   }
      //    return "";
      // };

      //Show Progress Text for only Task, not Project & Milestones.
      gantt.templates.progress_text = function(start, end, task){
        if (task.type != gantt.config.types.project) {
          return "<span>"+Math.round(task.progress*100)+ "% </span>";
        } else {
          return "";
        }
      };

      // Don't show Task text in task 
      // gantt.templates.task_text = function(start, end, task){
      //     return "";
      // };

      gantt.templates.task_class = function(start, end, task){
          if(task.type == gantt.config.types.project){
              return "gantt-parenttask-bar";
          }
          if (task.planned_end) {
            var classes = ['has-baseline'];
            if (end.getTime() > task.planned_end.getTime()) {
              classes.push('overdue');
            }
            return classes.join(' ');
          }
          return "";
      };

      gantt.attachEvent("onTaskLoading", function(task){
        task.planned_start = gantt.date.parseDate(task.planned_start, "xml_date");
        task.planned_end = gantt.date.parseDate(task.planned_end, "xml_date");
        return true;
      });

      // adding baseline display
      gantt.addTaskLayer(function draw_planned(task) {
        if (task.planned_start && task.planned_end) {
          var sizes = gantt.getTaskPosition(task, task.planned_start, task.planned_end);
          var el = document.createElement('div');
          el.className = 'baseline';
          el.style.left = sizes.left + 'px';
          el.style.width = sizes.width + 'px';
          el.style.top = sizes.top + gantt.config.task_height  + 13 + 'px';
          return el;
        }
        return false;
      });
      


      //init Gantt
      gantt.init($element[0]);
      gantt.load("./common/connector_extra.php");

      // Init Gantt Again when do resize 
      angular.element($window).bind('resize', function(){

        $scope.width = $window.innerWidth;
        // manuall $digest required as resize event
        // is outside of angular
        $scope.$digest();
        gantt.init($element[0]);
      });
      // Tree View
      // myTree = new dhtmlXTreeObject("treeboxbox_tree0","100%","100%",0);
      // myTree.setImagePath("../../../skins/web/imgs/dhxtree_web/");
      // myTree.load("../common/tree.xml");
    }
  };
}]);


function templateHelper($element){
  var template = $element[0].innerHTML;
  return template.replace(/[\r\n]/g,"").replace(/"/g, "\\\"").replace(/\{\{task\.([^\}]+)\}\}/g, function(match, prop){
    if (prop.indexOf("|") != -1){
      var parts = prop.split("|");
      return "\"+gantt.aFilter('"+(parts[1]).trim()+"')(task."+(parts[0]).trim()+")+\"";
    }
    return '"+task.'+prop+'+"';
  });
}
app.directive('ganttTemplate', ['$filter', function($filter){
  gantt.aFilter = $filter;

  return {
    restrict: 'AE',
    terminal:true,
   
    link:function($scope, $element, $attrs, $controller){
      var template =  Function('sd','ed','task', 'return "'+templateHelper($element)+'"');
      gantt.templates[$attrs.ganttTemplate] = template;
    }
  };
}]);

app.directive('ganttColumn', ['$filter', function($filter){
  gantt.aFilter = $filter;

  return {
    restrict: 'AE',
    terminal:true,
   
    link:function($scope, $element, $attrs, $controller){
      var label  = $attrs.label || " ";
      var width  = $attrs.width || "*";
      var align  = $attrs.align || "left";

      var template =  Function('task', 'return "'+templateHelper($element)+'"');
      var config = { template:template, label:label, width:width, align:align };
      
      if (!gantt.config.columnsSet)
          gantt.config.columnsSet = gantt.config.columns = [];

      if (!gantt.config.columns.length)
        config.tree = true;
      gantt.config.columns.push(config);

    }
  };
}]);

app.directive('ganttColumnAdd', ['$filter', function($filter){
  return {
    restrict: 'AE',
    terminal:true,
    link:function(){
      gantt.config.columns.push({ width:45, name:"add" });
    }
  }
}]);

})();